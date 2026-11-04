const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',timeout:90000,use:{baseURL:'http://127.0.0.1:8000',launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader'] }},webServer:{command:'python3 -m http.server 8000',port:8000,reuseExistingServer:true}});
