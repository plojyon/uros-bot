/**************************
 * DISCORD TIMETABLE BOT  *
 * ************************/
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
WARNING_CHANNEL = process.env["WARNING_CHANNEL"];
if (!WARNING_CHANNEL) console.log("Missing WARNING_CHANNEL");

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
	let url = "https://fmf-fri-timetable-scraper.herokuapp.com/";
	fetch(url, { method: "GET" })
		.then(res => res.json())
		.then((json) => {
			urnik = json;
			console.log("Got urnik. Length: "+urnik.length);
			urnik_unique = [];
			lectures = getUniqueLectures(urnik);
			for (i in lectures) {
				lect = urnik.filter((ura)=>{return ura.predmet.abbr+"-"+ura.tip == lectures[i]});
				urnik_unique[lectures[i]] = {...lect[0]}; // clone object
				delete urnik_unique[lectures[i]].profesor;
				urnik_unique[lectures[i]].ura = []; // ura is now array of occurrences
				for (l in lect) {
					time = lect[l].ura;
					prof = lect[l].profesor;
					urnik_unique[lectures[i]].ura.push(time+":15 ("+prof+")");
				}
				// sort occurrences by time
				urnik_unique[lectures[i]].ura.sort((a,b)=>{
					aa=parseInt(a.split(":")[0]);
					bb=parseInt(b.split(":")[0]);
					if (aa < bb) return -1;
					if (aa > bb) return 1;
					return 0;
				});
			}
			urnik = urnik_unique;
			console.log("urnik after uniquisation:");
			console.log(urnik);
		});
}


function warn(txt) {
	const channel = bot.channels.get(WARNING_CHANNEL);
	channel.send(txt);
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
			message.channel.send("```"+eval(message.content.substring(1))+"```");
			return;
		}
		catch(e) {
			message.channel.send("```"+e+"```");
			return;
		}
	}

	// %preferences["bot_role"] = message.mentions.roles.first() // @urnik
	if (message.guild !== null && message.isMentioned(bot.user)) {
		message.react("🥳");
		message.channel.send("I heard my name!");
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
var weekday_7am = new schedule.RecurrenceRule();
weekday_7am.dayOfWeek = [new schedule.Range(1, 5)]; // days are enumerated 0-6, starting with Sunday
weekday_7am.hour = 7;
weekday_7am.minute = 30; // default is null! removing this will cause the job to run every minute
schedule.scheduleJob(weekday_7am, () => { // run every day at 7 AM
	const channel = bot.channels.get(TESTING_CHANNEL);
	var now = new Date();
	var dan = (now.getDay()+6) % 7; // 0 should be Monday, not Sunday
	urnik_today = urnik.filter((ura) => {
		return ura["dan"] == dan;
	});

	message = "Dobro jutro! Tu je današnji urnik:";
	for (u in urnik_today) {
		type = (urnik_today[u].tip.indexOf("V") != -1)? "vaje" : "predavanja";
		message += "\n\n`"+urnik_today[u].predmet.name+"` - "+type+" ob ";
		message += urnik_today[u].ura.join(", ");
		message += "\nLink: ";
		if (urnik_today[u].link.indexOf("http") != -1)
			message += "<"+urnik_today[u].link+">";
		else
			message += urnik_today[u].link
	}
	channel.send(message);
});

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
