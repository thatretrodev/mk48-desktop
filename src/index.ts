// Modules to control application life and create native browser window
const { dialog, app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const DiscordRPC = require('discord-rpc');
const isReachable = require('is-reachable');

function getSettings(name: string) : string {
	if (typeof process.env["MK48_" + name.toUpperCase()] !== "undefined") {
		return process.env["MK48_" + name.toUpperCase()];
	}
	return "disabled";
}

let mainWindow;

function createWindow() {
	// Create the browser window.

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	});

	// Load mk48.io, but show an error message if it's not reachable.

	(async () => {
		if (!await isReachable("https://mk48.io")) {
			dialog.showMessageBoxSync(mainWindow, {
				message: "Unable to connect to mk48.io. Is your network connection working?",
				type: "error"
			});

			mainWindow.close();
		}

		mainWindow.loadURL("https://mk48.io");

		setTimeout(async () => {
			const args = process.argv[0] == "electron" || process.argv[0].endsWith("electron") ? process.argv.slice(2) : process.argv.slice(1);
		
			for (let i = 0; i < args.length; i++) {
				await mainWindow.webContents.executeJavaScript(fs.readFileSync(args[i], "utf8"));
			}
		}, 1000);
	})();

	mainWindow.setMenu(null);

	// Open DevTools if it's enabled.

	if (getSettings("debugmenu") == "enabled") {
		mainWindow.webContents.openDevTools();
	}
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(() => {
	createWindow();

	app.on("activate", function () {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.

		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.

app.on("window-all-closed", function () {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

const clientId = "869542716961345556";

DiscordRPC.register(clientId);

const rpc = new DiscordRPC.Client({ transport: "ipc" });
const startTimestamp = new Date();

async function setActivity() {
	if (!rpc || !mainWindow) {
		return;
	}

	const playername = await mainWindow.webContents.executeJavaScript("window.localStorage.name;") ?? "Unknown/Invalid Name!";
	const serverID = await mainWindow.webContents.executeJavaScript("Number(localStorage.serverId);") ?? null;
	
	let coords = "N/A";

	try {
		coords = await mainWindow.webContents.executeJavaScript(`try{document.getElementById("ship_status").firstChild.innerText.split("—")[3].split("\\n")[0].replace("(", "").replace(")", "").trim();}catch(e){}`) || "N/A";
	} catch (e) {}

	await mainWindow.webContents.executeJavaScript(`console.log("${coords}");`);

	let status = `Playing mk48.io ${serverID ? `on Server ${serverID}` : ""}`;

	// Dead

	const deathMessage = await mainWindow.webContents.executeJavaScript(`try{document.getElementsByClassName("reason")[0].innerText;}catch(e){}`);
	
	if (deathMessage) {
		status = deathMessage;
	}

	rpc.setActivity({
		details: status,
		state: getSettings("discoords") == "enabled" ? `in-game location: ${coords}` : `name: "${playername}"`,
		startTimestamp,
		instance: false,
		largeImageKey: "mk48io3"
	});
}

rpc.on("ready", () => {
	setActivity();

	setInterval(() => {
		setActivity();
	}, 15e3);
});

rpc.login({ clientId }).catch(console.error);