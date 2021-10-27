#!/usr/bin/python3.8

import base64
import sys
import subprocess
from PIL import Image
from PIL import ImageDraw
from PIL import ImageFont
import qrcode
from OpenSSL.crypto import FILETYPE_PEM, load_privatekey, sign, FILETYPE_PEM

# CONSTANTES
image = "ressources/Attestation.png"
steg_image = "ressources/Attestation_steg.png"
steg_image_poc = "../poc/Attestation_steg.png"
private_key_path = "../certification/private/private.pem"
private_key_poc_path = "../poc/private/private.pem"
password = b"cytech20212022"

########################################################################
#                            SIGNATURE                                 # 
########################################################################

def sign_data(data) : 
    key_file = open(private_key_path, "rb")
    key = key_file.read()
    key_file.close()
    pkey = load_privatekey(FILETYPE_PEM, key, passphrase=password)

    dataBytes = bytes(data, encoding='utf-8')
    signData = sign(pkey, dataBytes, "sha256")
    signData_b64 = base64.b64encode(signData)
    return signData_b64

########################################################################
#                            UTILE                                     # 
########################################################################

def shell_cmd(cmd): 
    res_b = subprocess.run(cmd, stdout=subprocess.PIPE)
    res = res_b.stdout.decode("utf-8")
    return res

def get_infos_tuple(): 
    nom     = sys.argv[1]
    prenom  = sys.argv[2]
    email   = sys.argv[3]
    diplome = sys.argv[4]
    return nom,prenom,email,diplome

def get_infos(): 
    nom     = sys.argv[1]
    prenom  = sys.argv[2]
    email   = sys.argv[3]
    diplome = sys.argv[4]
    return (nom+"&"+prenom+"&"+email+"&"+diplome+"&")

def get_bloc():
    ts = shell_cmd(["date"]).replace("\n","")
    return get_infos()+ts+"&"


def help():
    print("Hide data : python3 CreerAttestation.py <nom> <prenom> <email> <nom_diplôme>")

########################################################################
#                            STEGANOGRAPHIE                            # 
########################################################################


def vers_8bit(c):
	chaine_binaire = bin(ord(c))[2:]
	return "0"*(8-len(chaine_binaire))+chaine_binaire

def modifier_pixel(pixel, bit):
	# on modifie que la composante rouge
	r_val = pixel[0]
	rep_binaire = bin(r_val)[2:]
	rep_bin_mod = rep_binaire[:-1] + bit
	r_val = int(rep_bin_mod, 2)
	return tuple([r_val] + list(pixel[1:]))

def recuperer_bit_pfaible(pixel):
	r_val = pixel[0]
	return bin(r_val)[-1]

def cacher(image,message):
	dimX,dimY = image.size
	im = image.load()
	message_binaire = ''.join([vers_8bit(c) for c in message])
	posx_pixel = 0
	posy_pixel = 0
	for bit in message_binaire:
		im[posx_pixel,posy_pixel] = modifier_pixel(im[posx_pixel,posy_pixel],bit)
		posx_pixel += 1
		if (posx_pixel == dimX):
			posx_pixel = 0
			posy_pixel += 1
		assert(posy_pixel < dimY)

def recuperer(image,taille):
	message = ""
	dimX,dimY = image.size
	im = image.load()
	posx_pixel = 0
	posy_pixel = 0
	for rang_car in range(0,taille):
		rep_binaire = ""
		for rang_bit in range(0,8):
			rep_binaire += recuperer_bit_pfaible(im[posx_pixel,posy_pixel])
			posx_pixel +=1
			if (posx_pixel == dimX):
				posx_pixel = 0
				posy_pixel += 1
		message += chr(int(rep_binaire, 2))
	return message     

########################################################################
#                            VISIBLE                                   # 
########################################################################

def inserer_infos(image,nom,prenom,certification):
    d = ImageDraw.Draw(image)
    
    d.text((370,350), nom+ " " +prenom,font=ImageFont.truetype("ressources/font.ttf", 120), fill=(0,0,0))
    d.text((370,550), certification.replace("_"," "),font=ImageFont.truetype("ressources/font.ttf", 120), fill=(0,0,0))

########################################################################
#                            QRcode                                    # 
########################################################################

def build_qrcode(data):
        
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
    img = img.resize((250,250), Image.ANTIALIAS)
    return img

########################################################################
#                            Main                                      # 
########################################################################

def main():
    if len(sys.argv) != 5 :
        help()
        exit(-1)
        
    infos = get_infos()
    bloc = get_bloc()
    mon_image = Image.open(image)
    cacher(mon_image, bloc)
    inserer_infos(mon_image,get_infos_tuple()[0],get_infos_tuple()[1],get_infos_tuple()[3])   
    signature = sign_data(infos)
    qr_img = build_qrcode(signature)
    mon_image.paste(qr_img,(1400,920))
    mon_image.save(steg_image)
    print(infos)

main()


