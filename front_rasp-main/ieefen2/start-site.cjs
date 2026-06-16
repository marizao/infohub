const { exec } = require("child_process");
const path = require("path");

const servePath = "/usr/local/bin/serve";

const distPath = path.join(__dirname, "dist");
const port = 3000;

const command = `${servePath} ${distPath} -l ${port}`;

console.log(`[start-site.js] Iniciando o servidor com o comando: ${command}`);

const serverProcess = exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`[serve process error]: ${error}`);
    return;
  }
  if (stdout) {
    console.log(`[serve stdout]: ${stdout}`);
  }
  if (stderr) {
    console.error(`[serve stderr]: ${stderr}`);
  }
});

serverProcess.on("exit", (code) => {
  console.log(`[start-site.js] Processo 'serve' finalizado com código ${code}`);
});
