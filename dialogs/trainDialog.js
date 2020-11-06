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
const { Channels } = require('botbuilder-core');

const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const trainCard = require('../resources/TrainCard.json');

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATE_PROMPT = 'DATE_PROMPT';
const TRAIN_TICKET_INFO = 'TRAIN_TICKET_INFO';
// const SPECIAL_NUMBER_PROMPT = 'SPECIAL_NUMBER_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class TrainDialog extends CancelAndHelpDialog {
    constructor(dialogId, userState) {
        super(dialogId);

        this.trip = userState.createProperty(TRAIN_TICKET_INFO);

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
            this.trainSelectStep.bind(this),
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

    async trainSelectStep(step) {
        step.values.journeyDate = step.result;
        
        const array = [];

        //checking availability of trains and providing the user with options
        const query1 = `select * from train where (from_city='${step.values.from}' and to_city='${step.values.to}') and (train_date='${step.values.journeyDate}' and available_seats >= ${step.values.passengers});`;
        const data = await pool.execute(query1);
        for(let i=0; i<data[0].length; i++) {
            const trainInfo = data[0][i].train_name + " at " + data[0][i].train_time;
            array.push(trainInfo);
        }
        if (array.length <= 0) {
            await step.context.sendActivity('Unfortunately no trains are available based on your requirements. Please try a different mode of transport or a different date.');
            return await step.replaceDialog('root');
        }
        return await step.prompt(CHOICE_PROMPT, {
            prompt: 'Select the train and timing based on your preference',
            choices: ChoiceFactory.toChoices(array)
        });
    }
    
    async confirmStep(step) {
        step.values.trainName = step.result.value.split(' at ')[0];
        step.values.time = step.result.value.split(' at ')[1];
        
        let query2 = `select coach_number, available_seats from train where `;
        query2 += `(from_city='${step.values.from}' and to_city='${step.values.to}') `;
        query2 += `and (train_name='${step.values.trainName}' and train_date='${step.values.journeyDate}') and train_time='${step.values.time}'`;
        const data = await pool.execute(query2);
        step.values.trainNumber = data[0][0].coach_number;
        step.values.seats = data[0][0].available_seats;

        const train = step.values;

        let msg = `your starting location is ${ train.from }`;
        msg += `, your destination is ${train.to}`;
        msg += `, number of passenger(s) is/are ${ train.passengers }`;
        msg += `, date of journey is ${ train.journeyDate}`
        msg += ` and the train you have chosen is ${ train.trainName } at ${train.time}.`;
        await step.context.sendActivity(msg);

        return await step.prompt(CONFIRM_PROMPT, 'Do you wish to book ticket?', ['yes', 'no']);
    }

    async summaryStep(step) {
        if(step.result) {

            //updating remaining seats in the database
            const remainingSeats = step.values.seats - step.values.passengers;
            let query3 = `update train set available_seats=${remainingSeats} where `;
            query3 += `(from_city='${step.values.from}' and to_city='${step.values.to}') `;
            query3 += `and (train_name='${step.values.trainName}' and train_date='${step.values.journeyDate}') and train_time='${step.values.time}'`;
            await pool.execute(query3);

            //getting the seat numbers
            let seatNumbers = '';
            for(let i=0; i<step.values.passengers; i++) {
                if(i === step.values.passengers-1) {
                    seatNumbers += step.values.seats;
                }
                else {
                    seatNumbers += step.values.seats-- + ',';
                }
            }

            const train = step.values;
            train.seats = seatNumbers;
            
            //inserting ticket info into database
            let query4 = `insert into tickets(from_city, to_city, transport_mode, transport_name, travel_time, travel_date, seat_numbers) `;
            query4 += `values('${train.from}', '${train.to}', 'TRAIN', '${train.trainName}', '${train.time}', '${train.journeyDate}', '${train.seats}')`
            await pool.execute(query4);

            //getting ticket id
            let query5 = `select id from tickets where `;
            query5 += `(from_city='${train.from}' and to_city='${train.to}') `;
            query5 += `and (transport_mode='TRAIN' and transport_name='${train.trainName}') and (travel_time='${train.time}' and travel_date='${train.journeyDate}')`;
            const data = await pool.execute(query5);
            train.id = data[0][0].id;
    
            //Returning Adaptive card of user info
            trainCard.body[2].columns[1].items[0].text = train.id.toString();
            trainCard.body[3].columns[1].items[0].text = train.from;
            trainCard.body[4].columns[1].items[0].text = train.to;
            trainCard.body[5].columns[1].items[0].text = train.passengers.toString();
            trainCard.body[6].columns[1].items[0].text = train.journeyDate;
            trainCard.body[7].columns[1].items[0].text = train.time;
            trainCard.body[8].columns[1].items[0].text = train.seats;
            trainCard.body[9].columns[1].items[0].text = train.trainName;
            trainCard.body[10].columns[1].items[0].text = train.trainNumber;
    
            await step.context.sendActivity({
                text: 'Here is your Ticket:',
                attachments: [CardFactory.adaptiveCard(trainCard)]
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

module.exports.TrainDialog = TrainDialog;