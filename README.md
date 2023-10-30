# Timesheet in Slack

This is a sample application that illustrates how to build a tool for managing work hours using Slack's automation platform.

## Setup

Before getting started, first make sure you have a development workspace where you have permission to install apps. **Please note that the features in this project require that the workspace be part of [a Slack paid plan](https://slack.com/pricing).**

### Install the Slack CLI

To use this template, you need to install and configure the Slack CLI. Step-by-step instructions can be found in our [Quickstart Guide](https://api.slack.com/automation/quickstart).

### Clone the Template

Start by cloning this repository:

```zsh
# Clone this project onto your machine
$ slack create slack-timesheet -t seratch/slack-timesheet
# Change into the project directory
$ cd slack-timesheet
```

## Getting Started

I am confident that this app is designed to be extremely user-friendly. As soon as you install the app onto your Slack workspace and share the link trigger of the workflow app either in a canvas document or as a channel message, you'll be up and running immediately!

### Deploy The App

To deploy the app, simply run the `slack deploy` command in the root directory of the cloned app.

```
$ slack deploy
? Choose a deployed environment Install to a new workspace or organization
? Install to a new workspace or organization acme-corp T03E94MJU

🔔 If you leave this workspace or organization, you can no longer manage the installed apps
   Installed apps will belong to the workspace or organization if you leave the workspace

📚 App Manifest
   Created app manifest for "Timesheet" in "Acme Corp"

🏠 App Install
   Installing "Timesheet" app to "Acme Corp"
   Updated app icon: assets/icon.png
   Finished in 5.5s

⚡ Listing triggers installed to the app...
   There are no triggers installed for the app

⚡ Create a trigger
   Searching for trigger definition files under 'triggers/*'...
   Found 2 trigger definition files

? Choose a trigger definition file: triggers/open_timesheet_en-us.ts

⚡ Trigger successfully created!

   Timesheet Ft0639P6UJ1Z (shortcut)
   Created: 2023-10-29 22:48:35 +09:00 (1 second ago)
   Collaborators:
     Kaz Sera @seratch U03E94MK0
   Can be found and used by:
     everyone in the workspace
   https://slack.com/shortcuts/Ft063YR*****/ab6f8c4c8bfb********************

🎁 App packaged and ready to deploy
   0.042MB was packaged in 3.2s

🚀 Timesheet deployed in 15.2s
   App Owner:  seratch (U03E94MK0)
   Workspace:  Acme Corp (T03E94MJU)
   Dashboard:  https://slack.com/apps/A0636U9P3PX

🌩  Visit your workspace or organization to try out your live app!
   When you make any changes, update your app by re-running slack deploy

💌 We would love to know how things are going
   Survey your development experience with slack feedback --name platform-improvements

$
```

### Launch The App

This Timesheet app intracts with you only within a single modal view. To launch this modal dialogue, click on the link trigger, which was generated when you deployed the app, as shown below. Upon initial startup, the app will prompt you to specify your preferred language (and your country if pre-configured). Following this, you'll be fully equipped to monitor your work time via the app!

<img src="https://user-images.githubusercontent.com/19658/278875716-c13a3d98-4334-4527-8e35-65fcff9b2c77.gif" width=500>

Typically, you would click only the "Start/Finish Work" and "Start/Finish Break Time" buttons. There's no need to click anything else as long as you're keeping track of work and break times during your business hours. Sometimes, you may forget to press these buttons. In such cases, you can edit your entries as needed from the top page. Moreover, you can also input days off you have taken. This data will allow you to effortlessly verify if you are fulfilling the necessary work hours with consideration of day offs.

### Calendar View

To check/edit past inputs, you can use the Calendar view from the menu.

<img src="https://user-images.githubusercontent.com/19658/278875645-a69d8151-3e2d-4664-98e7-20ed39ef4da7.gif" width=500>

This feature can be particularly beneficial when setting time off information in advance. It allows you to navigate to a future date when you're taking time off. When you want to get a comprehensive view of the current month, the Monthly Report feature, which I will detail next, should prove to be even more convenient.

### Monthly Report

The Monthly Report feature can be helpful not just at the end of each month, but at any given time. By accessing this page, you're able to look back and reflect upon how the current month has been progressing so far.

<img src="https://user-images.githubusercontent.com/19658/278875593-eb547f79-aad5-44e7-b9fd-45f59d5696e7.gif" width=500>

If you click the "Send this in DM" button located in the upper right corner, a message containing a replicated report from the app will be delivered to you. Conveniently, the message also provides the raw JSON data as an attachment. Often, employees are required to input work data into a unfied corporate system. In such instances, utilizing the JSON data (e.g., writing a script, converting the JSON data structure to a required format) could help you achieve smooth data integration.

<img width="400" src="https://user-images.githubusercontent.com/19658/278876581-f7e07597-ac7d-447e-8876-50bfdc2b93ea.png">

### Projects

The "Project Code" management is an optional and advanced feature. This feature is typically used for managing detailed, segmental work hours for a particular purpose, project, or team. You can utilize project codes for tracking these specifics. Once you register a minimum of one active project code, this app will prompt all end-users to select a project code whenever they start their work time.

<img src="https://user-images.githubusercontent.com/19658/278875510-c09dc791-3ee1-4f80-928c-6d610418b89e.gif" width=500>

By default, setting a project code is optional. However, if your organization consistently requires all employees to set a code, you can modify the source code, `functions/internals/views.ts`, by removing the `"optional": true` flag in the relevant sections.

### Organization Policies

As an admin, you have the ability to manage policies that apply across your organization. These policies can become crucial when evaluating this application's utility for real business operations. For instance, in accordance with Japanese labor law, it is considered a best practice to limit manually created time records. In light of this strict policy, it is mandatory for employees to use a time card or an equivalent. One of the built-in organization policies allows this app to function as a virtual time card, thereby adhering to such regulations.

### Other Features

The development of this app has just begun, and it's still undergoing significant evolution! We are actively working on more features, including permission control, holiday considration, and more customization options. If you're interested, examining the datastore tables such as `admin_users`, `organization_policies`, `countries`, and `public_holidays` plus the code using the table could provide useful insights.

## Feedback

Whenever you have have any suggestions, questions, or discover a bug within this app, please feel free to submit an inquiry on this repository's issue tracker!
