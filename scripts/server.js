const path = require('path');
const express = require('express');
const app = express();

const shell = require('shelljs')

app.use(express.static(path.join(__dirname, 'public')))

const cookieParser = require('cookie-parser')

var compteSecret = ""

// Put these statements before you define any routes.
   // app.use(express.cookieParser());
    app.use(express.urlencoded());
    app.use(express.json());
/*#################### UTILS ####################*/

var nodemailer = require('nodemailer');

function sendMail(destinataire,object,content,file){
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'serabianth@cy-tech.fr',
        pass: 'Bohm4aeX'
      }
    });
        
    var mailOptions = {
      from: 'admin@cy-tech.fr',
      to: destinataire,
      subject: object,
      text: content,
      attachments: [{filename:"Certification.png",path: file}]
    };
        
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    }); 
  }

var crypto = require('crypto');

function encrypt(text,password){
  var cipher = crypto.createCipher('aes-256-ctr',password)
  var crypted = cipher.update(text,'utf8','hex')
  crypted += cipher.final('hex');
  return crypted;
}
 
function decrypt(text,password){
  var decipher = crypto.createDecipher('aes-256-ctr',password)
  var dec = decipher.update(text,'hex','utf8')
  dec += decipher.final('utf8');
  return dec;
}


 function verifyAuth(role,res,req){
  var pass = false
  if(req.headers.cookie.replace('session=')!=""){
    var cookie = req.headers.cookie
    user = decrypt(cookie.split('session=')[1],"HyperSafelyEncodedCookie")
    console.log(user)
    try {
      cookie = JSON.parse(user)
      if((cookie.role==role) && ((cookie.time+(5*60000))>Date.now())){
        pass = true
      }
    } catch (error) {
      console.log("errreur parsing : "+error)
    }
  }

  if(!pass){
    res.send('acces interdit')
  }

  return pass

}


/*#################### CONTROLLERS ####################*/

// DB Controller
const db = require("../db.json")


//OTP Controller

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');



  



/*#################### ROUTES ####################*/
app.get('/register', function (req, res) {

    const secretCode = speakeasy.generateSecret({
        name: "CYTECH-Certificate-Delivery",
  });
  
  
  //console.log(secretCode)
  compteSecret = secretCode.ascii
  qrcode.toDataURL(secretCode.otpauth_url,function(err,data){
      if(err){throw err}
      else{
          res.send('<img src="'+data+'"/>')
      }
  })
});

app.get('/login',function(req,res){
    res.sendFile('views/login.html', {root: __dirname })
})

app.post('/login',function(req, res) {
    var code = req.body.code
    var verified = speakeasy.totp.verify({
        secret:compteSecret,
        encoding:'ascii',
        token:code//6 code digits
    })

    if(verified){
      var cookie=encrypt('{"role":"admin","time":'+Date.now()+'}','HyperSafelyEncodedCookie')
      res.cookie('session',cookie)
      res.redirect('/admin')
    }else{
      res.sendFile('views/login.html', {root: __dirname })
    }
})



app.get('/admin',function(req,res){

  if(verifyAuth("admin",res,req)){
    
    html ="<h2>Demandes certificats :</h2></br><table>"

    for (let i = 0; i < db.users.length; i++) {
      html+='<tr><td>'+db.users[i].nom+'</td><td>'+db.users[i].prenom+'</td><td>'+db.users[i].diplome+'</td>'
      html+='<td><form action="/valider" method="POST"><button name="id" value='+i+' type="submit">Valider</button</form></td></tr>'
    }
    html +="</table>"
    demande = "<form action='/demande' method='POST'><input type='hidden' name='cert' type='text' value=''><input type='submit' value='Valider'</form>"
    res.send(html)

  }


})

app.post('/valider',function(req,res){
  if(verifyAuth("admin",res,req)){
    //generation certif + envoie par mail
    var user = db.users[req.body.id]
    shell.exec('./sign_data.sh '+user.nom+' '+user.prenom+' '+user.mail+' '+user.diplome.replace(' ','-'))
    
    text="Bonjour,\n Veuillez trouver en pièce jointe votre certificat.\nCordialement."
    sendMail(user.mail,'CYTECH - Votre certificat',text,'./ressources/Attestation_steg.png')
    
    
    res.end("Votre certificat vous a été envoyé par mail")
    
  }
})

app.get('/test_shell',function(){
  shell.exec('ls -la')
})

  app.listen(8000, () => {
    console.log(`Example app listening at http://localhost:8000`)
  })