// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const dateValidator = require("DateValidator").DateValidator;

const pool = require('../database');

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

const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const busCard = require('../resources/BusCard.json');

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATE_PROMPT = 'DATE_PROMPT';
const BUS_TICKET_INFO = 'BUS_TICKET_INFO';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class BusDialog extends CancelAndHelpDialog {
    constructor(dialogId, userState) {
        super(dialogId);

        this.bus = userState.createProperty(BUS_TICKET_INFO);

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new TextPrompt(DATE_PROMPT, this.journeyDateValidator));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.fromStep.bind(this),
            this.toStep.bind(this),
            this.passengersStep.bind(this),
            this.dateStep.bind(this),
            // this.busType.bind(this),
            this.busSelectStep.bind(this),
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
       
        const promptOptions = { prompt: 'Enter the number of passengers'};
        return await step.prompt(NUMBER_PROMPT, promptOptions);      

    }

    async dateStep(step) {
        step.values.passengers = step.result;
       
        const promptOptions = { 
            prompt: 'Enter the date of journey',
            retryPrompt: `Please enter date in DD/MM/YYYY format and later than today's date that is ${ (new Date()).toLocaleDateString() }` 
        };
        return await step.prompt(DATE_PROMPT, promptOptions);     

    }

    async busSelectStep(step) {
        step.values.journeyDate = step.result;
        
        let array = [];

        //check availability and put the available buses in array using sql
        const query1 = `select * from bus where (from_city='${step.values.from}' and to_city='${step.values.to}') and (bus_date='${step.values.journeyDate}' and available_seats >= ${step.values.passengers});`;
        const data = await pool.execute(query1);
        for(let i=0; i<data[0].length; i++) {
            const busInfo = data[0][i].bus_name + " at " + data[0][i].bus_time;
            array.push(busInfo);
        }
        if (array.length <= 0) {
            await step.context.sendActivity('Unfortunately no buses are available based on your requirements. Please try a different mode of transport or a different date.');
            return await step.replaceDialog('root');
        }
        return await step.prompt(CHOICE_PROMPT, {
            prompt: 'Select the bus and timing based on your preference',
            choices: ChoiceFactory.toChoices(array)
        });
    }
    
    async confirmStep(step) {
        step.values.busName = step.result.value.split(' at ')[0];
        step.values.time = step.result.value.split(' at ')[1];
        
        let query2 = `select bus_number, available_seats from bus where `;
        query2 += `(from_city='${step.values.from}' and to_city='${step.values.to}') `;
        query2 += `and (bus_name='${step.values.busName}' and bus_date='${step.values.journeyDate}') and bus_time='${step.values.time}'`;
        const data = await pool.execute(query2);
        step.values.busNumber = data[0][0].bus_number;
        step.values.seats = data[0][0].available_seats;
        
        const bus = step.values;

        let msg = `your starting location is ${ bus.from }`;
        msg += `, your destination is ${bus.to}`;
        msg += `, number of passenger(s) is/are ${ bus.passengers }`;
        msg += `, date of journey is ${ bus.journeyDate}`
        msg += ` and the bus you have chosen is ${ bus.busName } at ${bus.time}.`;
        await step.context.sendActivity(msg);

        return await step.prompt(CONFIRM_PROMPT, 'Do you wish to book ticket?', ['yes', 'no']);
    }

    async summaryStep(step) {
        if(step.result) {

            //get the seat numbers and update in the database about booked seats on that date

            //insert the ticket info in ticket table

            //get the ticket id from ticket table
            
            const bus = step.values;
            bus.seats = '21,22.23';
            bus.id = '1000';
    
            //Returning Adaptive card of user info
            busCard.body[2].columns[1].items[0].text = bus.id;
            busCard.body[3].columns[1].items[0].text = bus.from;
            busCard.body[4].columns[1].items[0].text = bus.to;
            busCard.body[5].columns[1].items[0].text = bus.passengers.toString();
            busCard.body[6].columns[1].items[0].text = bus.journeyDate;
            busCard.body[7].columns[1].items[0].text = bus.time;
            busCard.body[8].columns[1].items[0].text = bus.seats;
            busCard.body[9].columns[1].items[0].text = bus.busName;
            busCard.body[10].columns[1].items[0].text = bus.busNumber;
    
            await step.context.sendActivity({
                text: 'Here is your Ticket:',
                attachments: [CardFactory.adaptiveCard(busCard)]
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
}

module.exports.BusDialog = BusDialog;