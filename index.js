const fs = require("fs");
const os = require("os");
const path = require("path");
const chalk = require("chalk");
const Commander = require("commander");
const packageJson = require("./package.json");
const validateNpmPackageName = require("validate-npm-package-name");
const mkdir = require("make-dir");
const cpy = require("cpy");
const promisify = require("util").promisify;
const fsStat = promisify(fs.stat);
const fsReaddir = promisify(fs.readdir);
const spawn  = require("cross-spawn");

let projectPath = "";

new Commander.Command("create-hubs-app")
  .version(packageJson.version)
  .arguments("<project-path>")
  .usage(`${chalk.green("<project-path>")} [options]`)
  .action((arg) => {
    projectPath = arg.trim();
  })
  .allowUnknownOption()
  .parse(process.argv);

async function main() {
  const resolvedProjectPath = path.resolve(projectPath);
  const projectName = path.basename(resolvedProjectPath);

  const { validForNewPackages, errors } = validateNpmPackageName(projectName);

  if (!validForNewPackages) {
    throw new Error(`Invalid project name.${(errors && errors.length > 0 && " " + errors[0]) || ""}`);
  }

  console.log(`Creating a new Hubs app in ${resolvedProjectPath}.`);

  await createProjectDirectory(resolvedProjectPath);

  await cpy(path.join(__dirname, "template"), resolvedProjectPath);

  const initPackageJson = {
    name: projectName,
    version: "0.1.0",
    scripts: {
      login: "hubs login",
      start: "hubs start",
      deploy: "hubs deploy",
      logout: "hubs logout"
    }
  };

  fs.writeFileSync(
    path.join(resolvedProjectPath, "package.json"),
    JSON.stringify(initPackageJson, null, 2) + os.EOL
  );

  console.log("Installing packages. This might take a couple of minutes.");

  await installNpmPackages(resolvedProjectPath, ["hubs-sdk"]);

  console.log(chalk.green("Finished!"));
  console.log(`Created ${projectName} at ${resolvedProjectPath}
  
  Inside that directory you can run the following commands:

    ${chalk.blue("npm run login")}
      Log into your Hubs Cloud server. You need to do this first.

    ${chalk.blue("npm start")}
      Start the development server for your Hubs app.

    ${chalk.blue("npm run deploy")}
      Build and deploy your Hubs app to your Hubs Cloud instance.
    
    ${chalk.blue("npm run logout")}
      Log out of your Hubs Cloud server.

  Check the documentation for more information on getting set up with Hubs Cloud.
  https://hubs.mozilla.com/docs`);
}

main().catch((error) => {
  console.error(chalk.red("Error creating Hubs app:"));
  console.error("  " + chalk.red(error));
  process.exit(1)
});

async function createProjectDirectory(projectPath) {
  if (fs.existsSync(projectPath)) {
    const stat = await fsStat(projectPath);
  
    if (!stat.isDirectory()) {
      throw new Error(`${projectPath} is not a directory.`);
    }

    let files = await fsReaddir(projectPath);

    const ignoredFiles = [".DS_Store", "Thumbs.db"];

    files = files.filter((file) => ignoredFiles.indexOf(file) === -1);

    if (files.length !== 0) {
      throw new Error(`${projectPath} is not an empty directory.`);
    }
  } else {
    await mkdir(projectPath);
  }
}

function installNpmPackages(cwd, packages) {
  const prevCwd = process.cwd();
  process.chdir(cwd);

  const args = [
    'install',
    '--save',
    '--save-exact',
    '--loglevel',
    'error',
  ].concat(packages);

  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, { stdio: 'inherit' });
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Error running npm install`));
      } else {
        resolve();
      }
    });
  }).finally(() => {
    process.chdir(prevCwd);
  });
}
