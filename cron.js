// schedule this js file to run daily

// this sends a wakeup notification to the bot, who will respond
// with a daily schedule + deadlines on weekdays,
// and just deadlines on weekends

require('dotenv').config({path: __dirname + '/.env'}); // env variables (client secret)

WAKEUP_WEBHOOK = process.env["WAKEUP_WEBHOOK"];
if (!WAKEUP_WEBHOOK) {
	console.log("Missing WAKEUP_WEBHOOK. Aborting.");
	return;
}

require('axios')
	.post(WAKEUP_WEBHOOK, {
		content: "sudo wake up",
		username: "Uroš alarm clock",
	})
	.then(res => {
		console.log(`Woken up Uroš. Status code: ${res.statusCode}`);
	})
	.catch(error => {
		console.error(error);
	});
