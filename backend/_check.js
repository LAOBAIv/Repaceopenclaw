var h=require('http');
h.get('http://localhost:3001/health',function(r){
  var d='';
  r.on('data',function(c){d+=c;});
  r.on('end',function(){console.log('STATUS:',r.statusCode,d);});
}).on('error',function(e){console.log('FAIL:',e.message);});
