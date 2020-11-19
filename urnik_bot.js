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

urnik = [];
function get_urnik() {
	fetch(URNIK_API_URL, { method: "GET" })
	.then(res => res.json())
	.then((json) => {
		console.log("Got urnik. Lecture count: "+json.length);
		// split the array of classes into an array of days;
		// urnik[0] is an array of classes on Monday, etc.
		for (u in json) {
			if (!(json[u].dan in urnik)) urnik[json[u].dan] = [];
			urnik[json[u].dan].push(json[u]);
		}
		console.log("Day count: "+urnik.length);
		// for each day, group the duplicate classes together
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


// TODO:
help = "help text goes here";


bot.on("message", function(message) {
	//if (message.author.bot) return;

	// DEBUG:
	// if the message is from me and starts with %, eval() the message
	// and send the output back to the same channel, unless
	// the message was in a ```code block```, in which case console.log the output
	if (message.author.id === "356393895216545803" && message.content.indexOf("%") === 0) {
		try {
			if (message.content.indexOf("```" != 0)) {
				// not in a code block
				message.channel.send("```"+eval(message.content.substring(1))+"```")
					.catch((e)=>{console.log(e)})
			}
			else {
				// in a code block
				console.log(eval(message.content.slice(4,-3))); // do not send anything back
			}
			return;
		}
		catch(e) {
			// in case of errors, always report to the channel
			message.channel.send("```"+e+"```")
				.catch((e)=>{console.log(e)})
			return;
		}
	}

	// any bot can wake up Uroš, not only cron.js. This is intended behaviour.
	if (message.author.bot && message.content == "sudo wake up") {
		if (today() < 6) { // is weekday
			dailySchedule();
			dailyMentions();
			dailyDeadlines();
		}
		else {
			dailyMentions();
			dailyDeadlines();
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

function today() {
	let now = new Date();
	return (now.getDay()+6) % 7; // 0 should be Monday, not Sunday
}

function dailySchedule() {
	const channel = bot.channels.get(NOTIFICATION_CHANNEL);
	now = new Date();
	const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
	let date = now.toLocaleDateString("sl-SI", options);
	let today = today();

	var message = "Dobro jutro! Danes je "+date+".\nTu je današnji urnik:";
	for (u in urnik[today]) {
		let type = (urnik[today][u].tip.indexOf("V") != -1)? "vaje" : "predavanja";
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

function dailyDeadlines() {
	// TODO: which deadlines are today?
}

function dailyMentions() {
	// TODO: which forum posts mention today?
}

function getUniqueLectures(urnik) {
	let lectures = [];
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
