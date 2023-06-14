const ftp = require("basic-ftp") 

async function upload() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  try {
    await client.access({
      host: "preview.codequest.club",
      user: process.argv[2],
      password: process.argv[3],
      port: 21,
      secure: true,
      secureOptions: {
        rejectUnauthorized: false,
      },
    });
    await client.ensureDir(process.argv[4]);
    await client.uploadFromDir("build");
  } catch (err) {
    console.log(err);
  }
  client.close();
}

upload();
