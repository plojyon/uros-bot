/***************************
 *          UROŠ           *
 *  DISCORD TIMETABLE BOT  *
 ***************************/
// Invite link:
// https://discord.com/api/oauth2/authorize?client_id=770964922720321546&permissions=8&scope=bot


const Discord = require('discord.js');
const bot = new Discord.Client();
var fs = require('fs'); // FILE SYSTEM
require('dotenv').config({path: __dirname + '/.env'}); // env variables (client secret)
const fetch = require('node-fetch'); // to fetch timetable and moodle events
const schedule = require('node-schedule'); // send messages every day

TESTING_CHANNEL = process.env["TESTING_CHANNEL"];
if (!TESTING_CHANNEL) console.log("Missing TESTING_CHANNEL");
NOTIFICATION_CHANNEL = process.env["NOTIFICATION_CHANNEL"];
if (!NOTIFICATION_CHANNEL) console.log("Missing NOTIFICATION_CHANNEL");

URNIK_API_URL = process.env["URNIK_API_URL"];
if (!URNIK_API_URL) console.log("Missing URNIK_API_URL");
MOODLE_API_URL = process.env["URNIK_API_URL"];
if (!MOODLE_API_URL) console.log("Missing MOODLE_API_URL");

// currently, preferences cannot load because Heroku does not support persistent storage
// TODO: find a remote database solution instead
/*
// load preferences
fs.readFile("./preferences.json", function(err, data) {
	if (err) {
		console.log(err);
		return;
	};
	preferences = JSON.parse(data);
	console.log("Users' preferences loaded");
});
*/

urnik = {};
function get_urnik() {
	let url = API_URL;
	fetch(url, { method: "GET" })
		.then(res => res.json())
		.then((json) => {
			//urnik = json;
			console.log("Got urnik. Lecture count: "+json.length);
			urnik = [];
			for (u in json) {
				if (!(json[u].dan in urnik)) urnik[json[u].dan] = [];
				urnik[json[u].dan].push(json[u]);
			}
			console.log("Day count: "+urnik.length);
			for (dan in urnik) {
				urnik_unique = {};
				lectures = getUniqueLectures(urnik[dan]);
				for (i in lectures) {
					// grab all occurrences a lecture
					lect = urnik[dan].filter((ura)=>{return ura.predmet.abbr+"-"+ura.tip == lectures[i]});
					// clone the first occurrence, then we will replace
					// the ura field with an array of times and professors
					urnik_unique[lectures[i]] = {...lect[0]};
					delete urnik_unique[lectures[i]].profesor;
					urnik_unique[lectures[i]].ura = []; // ura is now array of occurrences
					// assemble array of occurrences
					for (l in lect) {
						time = lect[l].ura;
						prof = lect[l].profesor;
						urnik_unique[lectures[i]].ura.push(time+":15 ("+prof+")");
						// ura: [ '8:15 (Nikolaj Zimic)', '10:15 (Nikolaj Zimic)' ],
					}
					// sort occurrences by time
					urnik_unique[lectures[i]].ura.sort((a,b)=>{
						aa=parseInt(a.split(":")[0]); // only the hour should vary anyway
						bb=parseInt(b.split(":")[0]);
						if (aa < bb) return -1;
						if (aa > bb) return 1;
						return 0;
					});
				}
				urnik[dan] = urnik_unique;
			}
			console.log("urnik after uniquisation:");
			console.log(urnik);
		});
}


function warn(txt) {
	const channel = bot.channels.get(WARNING_CHANNEL);
	channel.send(txt)
		.catch((e)=>{console.log(e)})
}

// TODO:
help = "help text goes here";


bot.on("message", function(message) {
	var msg = message.content.toLowerCase(); // case insensitive

	user = message.author.id;
	channel = message.channel.id;

	if (message.author.bot) return;

	// DEBUG:
	// if the message is from me and starts with %, eval() the message
	// and send the output back to the same channel
	if (message.author.id === "356393895216545803" && msg.indexOf("%") === 0) {
		try {
			if (message.content.indexOf("```" != 0)) {
				message.channel.send("```"+eval(message.content.substring(1))+"```")
					.catch((e)=>{console.log(e)})
			}
			else {
				console.log(eval(message.content.slice(4,-3))); // do not send anything back
			}
			return;
		}
		catch(e) {
			message.channel.send("```"+e+"```")
				.catch((e)=>{console.log(e)})
			return;
		}
	}

	if (message.guild !== null && message.isMentioned(bot.user)) {
		message.react("🥳")
			.catch((e)=>{console.log(e)})
		message.channel.send("I heard my name!")
			.catch((e)=>{console.log(e)})
		//message.author.send(help);
		return;
	}
});


bot.on('ready', function() {
	console.log('Uroš ready!'); // bot initialization complete
	//bot.user.setActivity("Analiza"); // TODO: set to whatever is currently going on
});

console.log("Uroš is waking up ...");
bot.login(process.env["CLIENT_SECRET"]).then(() => {
	console.log("Logged in alright"); // didn't crash (yet)
});

urnik = get_urnik();

// TODO: check for moodle posts daily (or bidaily) and notify of deadlines
// notify deadlines even on weekends, so make a new schedule!

// send a daily digest every weekday at 7 am
//var weekday_7am = new schedule.RecurrenceRule();
//weekday_7am.dayOfWeek = [new schedule.Range(1, 5)]; // days are enumerated 0-6, starting with Sunday
//weekday_7am.hour = 7;
//weekday_7am.minute = 30; // default is null! removing this will cause the job to run every minute
//schedule.scheduleJob(weekday_7am, ()=>{dailySchedule()}); // run every day at 7 AM
const CronJob = require('cron');
const dailyScheduleJob = new CronJob.CronJob (
	'47 9 * * 1-5', // “At 07:30 every weekday” https://crontab.guru/
	dailySchedule,
	null, //oncomplete
	false //start flag
);
dailyScheduleJob.start()

function dailySchedule() {
	const channel = bot.channels.get(NOTIFICATION_CHANNEL);
	var now = new Date();
	var today = (now.getDay()+6) % 7; // 0 should be Monday, not Sunday

	message = "Dobro jutro! Tu je današnji urnik:";
	for (u in urnik[today]) {
		type = (urnik[today][u].tip.indexOf("V") != -1)? "vaje" : "predavanja";
		message += "\n\n`"+urnik[today][u].predmet.name+" - "+type+"` ob ";
		message += urnik[today][u].ura.join(", ");
		message += "\nLink: ";
		if (urnik[today][u].link.indexOf("http") == 0)
			message += "<"+urnik[today][u].link+">"; // disable link preview
		else
			message += urnik[today][u].link
	}
	channel.send(message)
		.catch((e)=>{console.log(e)})
}

function getUniqueLectures(urnik) {
	lectures = [];
	for (i in urnik) {
		if (!(urnik[i].predmet.abbr in lectures)) {
			lectures.push(urnik[i].predmet.abbr+"-"+urnik[i].tip);
		}
	}
	return lectures;
}

/*
function random(min, max) {
	return Math.floor(Math.random() * (max-min)) + min;
}
*/
