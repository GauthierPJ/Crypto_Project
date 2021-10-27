#!/usr/bin/python3.8

from OpenSSL.crypto import load_publickey, FILETYPE_PEM, verify, X509
import base64

from PIL import Image
#sudo apt install libzbar0
#pip3 install pyzbar
from pyzbar.pyzbar import decode
import sys

steg_image = sys.argv[1]

private_key_path = "../certification/ca.pub"
private_key_poc_path = "../poc/ca.pub"

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
  
def recuperer(image):
	message = ""
	dimX,dimY = image.size
	im = image.load()
	posx_pixel = 0
	posy_pixel = 0
	cpt = 0
	taille_max = 500
	for rang_car in range(0,taille_max):
		rep_binaire = ""
		for rang_bit in range(0,8):
			rep_binaire += recuperer_bit_pfaible(im[posx_pixel,posy_pixel])
			posx_pixel +=1
			if (posx_pixel == dimX):
				posx_pixel = 0
				posy_pixel += 1
		char = chr(int(rep_binaire, 2))
		message += char
		if(char == '&') : 
			cpt +=1
		if(cpt>3) : 
			return message

########################################################################
#                            QRCODE                                    # 
########################################################################

def get_data_from_qrcode(): 
    img = Image.open(steg_image)
    area = (1400,920, 1650, 1170)
    cropped_img = img.crop(area)
    data = decode(cropped_img)
    signature = data[0][0]
    return signature

########################################################################
#                            VERIFY                                    # 
########################################################################

def verify_sign(pub_key_path, signature, data) :

    pub_key_flux = open(pub_key_path,'r')
    pub_key = pub_key_flux.read()
    pub_key_flux.close()

    pkey = load_publickey(FILETYPE_PEM, pub_key)

    x509 = X509()
    x509.set_pubkey(pkey)
    
    try:
        verify(x509, signature, data, 'sha256')
        return True
    except:
        return False
    
def main() : 
    mon_image = Image.open(steg_image)
    message_retrouve = recuperer(mon_image)
    signature_b64 = get_data_from_qrcode()
    signature = base64.b64decode(signature_b64)
    
    
    if(verify_sign(private_key_path, signature,message_retrouve.encode())) : 
        print("OK")
    else : 
        print("KO")
        
main()