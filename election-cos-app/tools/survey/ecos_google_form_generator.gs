/**
 * Election-COS (ECOS) — Google Form Generator & Automated Analytics Router
 *
 * Instructions:
 * 1. Open https://docs.google.com/spreadsheets/d/1E_XI7lghUzYuPvb1vgZh03G31DthRrEztFll1epgjHA/edit
 * 2. Go to Extensions -> Apps Script, paste this entire file, and click Save.
 * 3. Run `createEcosSurveyForm()` once and authorize permissions.
 *    - It creates the Google Form, links responses to this Sheet, and installs the
 *      `onFormSubmit` trigger to email responses and analytics to admin@electioncos.co.za.
 *    - Check View -> Execution Log for the live Form URL and Edit URL.
 */

const TARGET_SPREADSHEET_ID = "1E_XI7lghUzYuPvb1vgZh03G31DthRrEztFll1epgjHA";
const ANALYTICS_RECIPIENT = "admin@electioncos.co.za";
const DASHBOARD_URL = "https://electioncos.co.za";

function createEcosSurveyForm() {
  const form = FormApp.create("Election-COS Post-Election Voter Survey (LGE 2026)");
  form.setDescription(
    "Required data collection step before downloading the Election-COS Voter Intelligence Dashboard (~4 minutes). " +
    "Questions focus on voter experience, municipal priorities, governance, and trust in democratic institutions — not ballot choices.\n\n" +
    "Don't know your ward number? Open Google Maps (https://www.google.com/maps) to confirm your suburb/address, " +
    "then look up your ward at https://electioncos.co.za/my-ward."
  );
  form.setCollectEmail(true);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    "Thank you for completing the Election-COS Post-Election Voter Survey. " +
    "Your response has been recorded.\n\n" +
    "Download / open the Voter Intelligence Dashboard at: " + DASHBOARD_URL
  );

  // Step 1 — Respondent Details
  form.addSectionHeaderItem()
    .setTitle("Step 1 — Respondent Details (Required)");

  form.addTextItem()
    .setTitle("Municipality")
    .setHelpText("Enter your South African municipality and/or MDB code (e.g., JB Marks NW405, City of Tshwane TSH, City of Johannesburg JHB).")
    .setRequired(true);

  form.addTextItem()
    .setTitle("Ward Number")
    .setHelpText("e.g. Ward 12 or NW405-W12. Don't know your ward? Check your location on Google Maps (https://www.google.com/maps) and look up your ward at https://electioncos.co.za/my-ward.")
    .setRequired(true);

  // Section A — Voting Experience
  form.addPageBreakItem().setTitle("Section A — Voting Experience");

  form.addMultipleChoiceItem()
    .setTitle("Q1. Did you vote in the 4 November 2026 Local Government Election?")
    .setChoiceValues([
      "Yes, in person on 4 November",
      "Yes, as a special vote (2–3 November)",
      "No — I am a registered voter but did not vote",
      "No — I am not registered to vote"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q2. If you did not vote, what was the main reason?")
    .setChoiceValues([
      "Could not get time off work",
      "Long queues / distance to voting station",
      "My vote does not make a difference",
      "No party represents my interests",
      "Health or mobility challenge",
      "Not applicable / Other"
    ])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle("Q3. How satisfied were you with the administration of your voting station?")
    .setChoiceValues([
      "Very satisfied — smooth and organised",
      "Satisfied",
      "Neutral",
      "Dissatisfied — there were problems",
      "Very dissatisfied — serious irregularities"
    ])
    .setRequired(true);

  // Section B — Municipal Priorities
  form.addPageBreakItem().setTitle("Section B — Municipal Priorities");

  form.addMultipleChoiceItem()
    .setTitle("Q4. What is the single most important issue your municipal council must address in its first 100 days?")
    .setChoiceValues([
      "Water supply and reliability",
      "Electricity and load-shedding",
      "Unemployment and local job creation",
      "Roads and infrastructure",
      "Safety and policing",
      "Housing and land",
      "Refuse collection and sanitation"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q5. How has service delivery in your ward changed over the past 5 years?")
    .setChoiceValues([
      "Significantly improved",
      "Slightly improved",
      "No change",
      "Slightly worse",
      "Significantly worse"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q6. How often do you experience unplanned water interruptions in your area?")
    .setChoiceValues([
      "Rarely or never",
      "Once a month or less",
      "Several times a month",
      "Every week",
      "Almost daily"
    ])
    .setRequired(true);

  // Section C — Coalition & Governance
  form.addPageBreakItem().setTitle("Section C — Coalition & Governance");

  form.addMultipleChoiceItem()
    .setTitle("Q7. Where no party holds a majority, councils require a coalition. Which governance arrangement would best serve your ward?")
    .setChoiceValues([
      "Multi-party coalition agreement with a shared programme",
      "Two-party coalition between the largest parties",
      "Minority council with issue-by-issue votes",
      "Independent or local civic-led executive",
      "I don't know / it doesn't matter to me"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q8. How much do you trust your local municipality to manage public funds responsibly?")
    .setChoiceValues([
      "A great deal",
      "Somewhat",
      "Not very much",
      "Not at all",
      "Don't know"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q9. Do you believe your ward councillor represents your community's needs effectively?")
    .setChoiceValues([
      "Yes, strongly",
      "Yes, somewhat",
      "Neutral",
      "No, not really",
      "No, not at all"
    ])
    .setRequired(true);

  // Section D — Democratic Sentiment
  form.addPageBreakItem().setTitle("Section D — Democratic Sentiment");

  form.addMultipleChoiceItem()
    .setTitle("Q10. How confident are you that the 2026 LGE results accurately reflected the will of voters in your municipality?")
    .setChoiceValues([
      "Very confident — the IEC ran a credible election",
      "Fairly confident",
      "Not very confident",
      "Not at all confident — there were irregularities"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q11. Are you aware of the IEC's special vote mechanism for elderly, disabled, and ill voters?")
    .setChoiceValues([
      "Yes, I knew about it and have used it or know someone who has",
      "Yes, I knew about it but no one in my household used it",
      "I had heard of it but did not fully understand it",
      "No, this is the first I am hearing about it"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q12. How likely are you to vote in the next national or local election?")
    .setChoiceValues([
      "Definitely will vote",
      "Likely will vote",
      "Unsure",
      "Unlikely to vote",
      "Definitely will not vote"
    ])
    .setRequired(true);

  // Section E — Platform Engagement & POPIA Consent
  form.addPageBreakItem().setTitle("Section E — Platform Engagement & POPIA Consent");

  form.addCheckboxItem()
    .setTitle("Q13. Where do you get most of your information about local government and elections? (Choose all that apply)")
    .setChoiceValues([
      "WhatsApp groups",
      "Facebook",
      "SABC TV / radio",
      "Local or community newspaper",
      "Ward committee meetings",
      "Political party posters and flyers",
      "X (Twitter) / TikTok",
      "Word of mouth from neighbours and family"
    ])
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle("Q14. Would you be willing to participate in future ward-level surveys or community feedback sessions?")
    .setChoiceValues([
      "Yes — I am happy to be contacted again",
      "Maybe — depends on the topic",
      "Prefer anonymous surveys only",
      "No, I prefer not to be contacted"
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle("Q15. In your own words: what one change would make the biggest difference to your daily life in your municipality?")
    .setRequired(false);

  form.addCheckboxItem()
    .setTitle("POPIA Consent")
    .setChoiceValues([
      "I consent to Election-COS recording my survey response. Consent is recorded before anything is stored; we do not sell personal information (POPIA), and my records can be suppressed from use on request via electioncos.co.za/contact."
    ])
    .setRequired(true);

  // Link to the Responses & Analytics Google Sheet
  form.setDestination(FormApp.DestinationType.SPREADSHEET, TARGET_SPREADSHEET_ID);

  // Install automated email routing trigger
  ScriptApp.newTrigger("onFormSubmit")
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log("Published Form URL: " + form.getPublishedUrl());
  Logger.log("Edit Form URL: " + form.getEditUrl());
}

/**
 * Triggered automatically on every new Google Form submission.
 * Routes response details and live sheet analytics to admin@electioncos.co.za.
 */
function onFormSubmit(e) {
  const response = e.response;
  const email = response.getRespondentEmail() || "Not provided";
  const items = response.getItemResponses();

  const lines = [
    "New Election-COS Voter Survey Submission",
    "Timestamp: " + response.getTimestamp().toISOString(),
    "Respondent Email: " + email,
    ""
  ];
  items.forEach(function (ir) {
    lines.push(ir.getItem().getTitle() + ": " + JSON.stringify(ir.getResponse()));
  });

  const ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
  const analyticsSheet = ss.getSheetByName("Data Analytics");
  const totalResponses = analyticsSheet ? analyticsSheet.getRange("B2").getValue() : "See Sheet";

  lines.push("");
  lines.push("Total Responses Recorded: " + totalResponses);
  lines.push("Live Responses & Analytics Sheet: " + ss.getUrl());

  MailApp.sendEmail({
    to: ANALYTICS_RECIPIENT,
    subject: "[ECOS Survey] New Response — Total: " + totalResponses,
    body: lines.join("\n")
  });
}