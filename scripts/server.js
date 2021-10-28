const path = require('path');
const express = require('express');
const fs = require('fs')
const app = express();
const bodyParser = require('body-parser')
const fileUpload = require('express-fileupload');

const shell = require('shelljs')
app.use(fileUpload({
  createParentPath: true
}));
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

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
    let cookies_sep = cookie.split(";")
    for (let i = 0; i < cookies_sep.length; i++) {
      cookie = cookies_sep[i].split('=')[0].trim()
      if(cookie=="session"){
        user=decrypt(cookies_sep[i].split('=')[1].trim(),"HyperSafelyEncodedCookie")
        
      }
    }
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
  
  compteSecret = secretCode.ascii
  qrcode.toDataURL(secretCode.otpauth_url,function(err,data){
      if(err){throw err}
      else{
          res.send('<img src="'+data+'"/>')
      }
  })
});


app.get('/verify',function(req,res){
  res.sendFile('views/verify.html', {root: __dirname });
})

app.post('/verify',function(req,res){
  file = req.files.file
  fs.writeFile("tmp/"+file.name, file.data,function(){
    value = shell.exec('./VerifierAttestation.py tmp/'+file.name)    
    if(value.stdout=="OK\n"){
      res.sendFile('views/valide.html', {root: __dirname })
    }
    else{
      res.sendFile('views/invalide.html', {root: __dirname })
    }
  })
})

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
      res.cookie('data',JSON.stringify(db.users))
      res.sendFile('views/demandes.html', {root: __dirname })


  }
})

app.post('/valider',function(req,res){
  if(verifyAuth("admin",res,req)){
    //generation certif + envoie par mail
    var user = db.users[req.body.id]
    shell.exec('./CreerAttestation.py '+user.nom+' '+user.prenom+' '+user.mail+' '+user.diplome)
    
    text="Bonjour,\n Veuillez trouver en pièce jointe votre certificat.\nCordialement."
    sendMail(user.mail,'CYTECH - Votre certificat',text,'./ressources/Attestation_steg.png')
    res.sendFile('views/envoyer.html', {root: __dirname })

    
  }
})


  app.listen(8000, () => {
    console.log(`Example app listening at http://localhost:8000`)
  })