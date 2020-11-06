// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const dateValidator = require("DateValidator").DateValidator;

const { CardFactory } = require('botbuilder');
const {
    AttachmentPrompt,
    ChoiceFactory,
    ChoicePrompt,
    ComponentDialog,
    ConfirmPrompt,
    DialogSet,
    DialogTurnStatus,
    NumberPrompt,
    TextPrompt,
    WaterfallDialog
} = require('botbuilder-dialogs');
const { Channels } = require('botbuilder-core');

const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const planeCard = require('../resources/PlaneCard.json');

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATE_PROMPT = 'DATE_PROMPT';
const PLANE_TICKET_INFO = 'PLANE_TICKET_INFO';
// const SPECIAL_NUMBER_PROMPT = 'SPECIAL_NUMBER_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class PlaneDialog extends CancelAndHelpDialog {
    constructor(dialogId, userState) {
        super(dialogId);

        this.trip = userState.createProperty(PLANE_TICKET_INFO);

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new TextPrompt(DATE_PROMPT, this.journeyDateValidator));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));
        // this.addDialog(new TextPrompt(SPECIAL_NUMBER_PROMPT, this.numberValidator));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.fromStep.bind(this),
            this.toStep.bind(this),
            this.passengersStep.bind(this),
            this.dateStep.bind(this),
            // this.planeType.bind(this),
            this.planeSelectStep.bind(this),
            this.confirmStep.bind(this),
            this.summaryStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async fromStep(step) {
        return await step.prompt(TEXT_PROMPT, 'Enter the name of the city from where you want to travel');
    }

    async toStep(step) {
        step.values.from = step.result;

        return await step.prompt(TEXT_PROMPT, {
            prompt: 'Enter the name of the city you want to travel to'
        });
    }
    
    async passengersStep(step) {
        step.values.to = step.result;
       
        //add date validator ahead from today's date
        const promptOptions = { prompt: 'Enter the number of passengers'};
        return await step.prompt(NUMBER_PROMPT, promptOptions);      

    }

    async dateStep(step) {
        step.values.passengers = step.result;
       
        //add date validator ahead from today's date
        const promptOptions = { 
            prompt: 'Enter the date of journey',
            retryPrompt: `Please enter date in DD/MM/YYYY format and later than today's date that is ${ (new Date()).toLocaleDateString() }` 
        };
        return await step.prompt(DATE_PROMPT, promptOptions);      

    }

    async planeSelectStep(step) {
        step.values.journeyDate = step.result;

        //check availability and put the available planees in array using sql
        
        const array = ['a', 'b'];
        return await step.prompt(CHOICE_PROMPT, {
            prompt: 'Select the plane and timing based on your preference',
            choices: ChoiceFactory.toChoices(array)
        });
    }
    
    async confirmStep(step) {
        step.values.planeName = step.result.value;
        
        //get values on the basis of user's choice
        step.values.planeName = 'TATA plane'; //
        step.values.planeNumber = 'OD1234';   //
        step.values.time = '7:00 AM';         //

        const plane = step.values;

        let msg = `your starting location is ${ plane.from }`;
        msg += `, your destination is ${plane.to}`;
        msg += `, number of passenger(s) is/are ${ plane.passengers }`;
        msg += `, date of journey is ${ plane.journeyDate}`
        msg += ` and the plane you have chosen is ${ plane.planeName }.`;
        await step.context.sendActivity(msg);

        return await step.prompt(CONFIRM_PROMPT, 'Do you wish to book ticket?', ['yes', 'no']);
    }

    async summaryStep(step) {
        if(step.result) {

            //get the seat numbers and update in the database about booked seats on that date

            //insert the ticket info in ticket table

            //get the ticket id from ticket table
            
            const plane = step.values;
            plane.seats = '21,22.23';
            plane.id = '1000';
    
            //Returning Adaptive card of user info
            planeCard.body[2].columns[1].items[0].text = plane.id;
            planeCard.body[3].columns[1].items[0].text = plane.from;
            planeCard.body[4].columns[1].items[0].text = plane.to;
            planeCard.body[5].columns[1].items[0].text = plane.passengers.toString();
            planeCard.body[6].columns[1].items[0].text = plane.journeyDate;
            planeCard.body[7].columns[1].items[0].text = plane.time;
            planeCard.body[8].columns[1].items[0].text = plane.seats;
            planeCard.body[9].columns[1].items[0].text = plane.planeName;
            planeCard.body[10].columns[1].items[0].text = plane.planeNumber;
    
            await step.context.sendActivity({
                text: 'Here is your Ticket:',
                attachments: [CardFactory.adaptiveCard(planeCard)]
            });
            await step.context.sendActivity('Type anything to book more tickets.');
            // WaterfallStep always finishes with the end of the Waterfall or with another dialog; here it is the end.
            return await step.endDialog();
        }
        await step.context.sendActivity('You did not confirm booking. Type anything to continue.');
        return await step.endDialog();
    }

    async journeyDateValidator(promptContext) {
        // This condition is our validation rule. You can also change the value at this point.
        if(promptContext.recognized.succeeded) {
            let date = promptContext.recognized.value.split("/");
            let todayDate = (new Date()).toLocaleDateString().split("/");
            if(date.length <= 1) {
                return false;
            }
            if(date[2].toString().length === 4) {
                if(date[2] > todayDate[2]) {
                    return dateValidator.validate(date[2], date[1], date[0]);
                }
                if(date[2] === todayDate[2]) {
                    if(date[1] > todayDate[1]) {
                        return dateValidator.validate(date[2], date[1], date[0]);    
                    }
                    if(date[1] === todayDate[1]) {
                        if(date[0] > todayDate[0]) {
                            return dateValidator.validate(date[2], date[1], date[0]);
                        }
                    }
                }
            }
        }
        return false;
    }

    // async numberValidator(promptContext) {
    //     if (promptContext.recognized.succeeded) {
    //         const input = promptContext.recognized.value;
    //         return (Number.isInteger(parseInt(input)) || input.toLowerCase() == 'quit' || input.toLowerCase() == 'exit');
    //     }
    // }
}

module.exports.PlaneDialog = PlaneDialog;