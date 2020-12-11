// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const dateValidator = require("DateValidator").DateValidator;

const pool = require('../database');

const { CardFactory } = require('botbuilder');
const {
    ComponentDialog,
    ConfirmPrompt,
    NumberPrompt,
    TextPrompt,
    WaterfallDialog
} = require('botbuilder-dialogs');

const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

const busCard = require('../resources/BusCard.json');
const transportOptionsCard = require('../resources/TransportOptionsCard.json');

const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const DEPARTURE_PROMPT = 'DEPARTURE_PROMPT';
const ARRIVAL_PROMPT = 'ARRIVAL_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATE_PROMPT = 'DATE_PROMPT';
const BUS_TICKET_INFO = 'BUS_TICKET_INFO';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';

class BusDialog extends CancelAndHelpDialog {
    constructor(dialogId, userState) {
        super(dialogId);

        this.bus = userState.createProperty(BUS_TICKET_INFO);

        this.addDialog(new TextPrompt(DEPARTURE_PROMPT, this.fromLocationValidator));
        this.addDialog(new TextPrompt(ARRIVAL_PROMPT, this.toLocationValidator));
        this.addDialog(new TextPrompt(DATE_PROMPT, this.journeyDateValidator));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.fromStep.bind(this),
            this.toStep.bind(this),
            this.passengersStep.bind(this),
            this.dateStep.bind(this),
            this.busSelectStep.bind(this),
            this.confirmStep.bind(this),
            this.summaryStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async fromStep(step) {
        return await step.prompt(DEPARTURE_PROMPT, {
            prompt: 'Enter the departure location',
            retryPrompt: 'Please enter a valid location'
        });
    }

    async toStep(step) {
        try{
            const name = step.result;
            const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            step.values.from = nameCapitalized;

            return await step.prompt(ARRIVAL_PROMPT, {
                prompt: 'Enter the arrival location',
                retryPrompt: 'Please enter a valid location'
            });
        }
        catch(err) {
            await step.context.sendActivity('Server side error! Please try again or come back later.');
            return await step.replaceDialog('root');
        }
    }
    
    async passengersStep(step) {
        try{
            const name = step.result;
            const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            step.values.to = nameCapitalized;
        
            const promptOptions = { prompt: 'Enter the number of passengers'};
            return await step.prompt(NUMBER_PROMPT, promptOptions);      
        }
        catch(err) {
            await step.context.sendActivity('Server side error! Please try again or come back later.');
            return await step.replaceDialog('root');
        }
    }

    async dateStep(step) {
        try{
            step.values.passengers = step.result;
        
            const promptOptions = { 
                prompt: 'Enter the date of journey',
                retryPrompt: `Please enter date in DD/MM/YYYY format and later than today's date that is ${ (new Date()).toLocaleDateString() }` 
            };
            return await step.prompt(DATE_PROMPT, promptOptions);     
        }
        catch(err) {
            await step.context.sendActivity('Server side error! Please try again or come back later.');
            return await step.replaceDialog('root');
        }
    }

    async busSelectStep(step) {
        try{
            let validDate = '';
            let dateInp = step.result.split('/');
            if(dateInp[0].length < 2) {
                dateInp[0] = '0' + dateInp[0];
            }
            if(dateInp[1].length < 2) {
                dateInp[1] = '0' + dateInp[1];
            }
            for(let i=0; i<dateInp.length; i++) {
                if(i === dateInp.length-1) {
                    validDate += dateInp[i];
                }
                else {
                    validDate += dateInp[i] + '/';
                }
            }
            step.values.journeyDate = validDate;

            //checking availability of buses and providing the user with options
            const query1 = `select * from bus where (from_city='${step.values.from}' and to_city='${step.values.to}') and (bus_date='${step.values.journeyDate}' and available_seats >= ${step.values.passengers});`;
            const data = await pool.execute(query1);
            while(transportOptionsCard.body.length > 1) {
                transportOptionsCard.body.pop();
            }
            let found = false;
            for(let i=0; i<data[0].length; i++) {
                found = true;
                const busInfo = data[0][i].bus_name + " at " + data[0][i].bus_time;
                const busItem = {
                    type: 'ActionSet',
                    actions: [
                        {
                            type: 'Action.Submit',
                            title: busInfo,
                            data: busInfo
                        }
                    ]
                };
                transportOptionsCard.body.push(busItem);
            }
            if (!found) {
                await step.context.sendActivity('No buses are available based on your requirements. Please try a different mode of transport or a different date.');
                return await step.replaceDialog('root');
            }

            await step.context.sendActivity({
                attachments: [CardFactory.adaptiveCard(transportOptionsCard)]
            });
            return ComponentDialog.EndOfTurn;
        }
        catch(err) {
            await step.context.sendActivity('Server side error! Please try again or come back later.');
            return await step.replaceDialog('root');
        }
    }
    
    async confirmStep(step) {
        try{
            step.values.busName = step.context.activity.text.split(' at ')[0];
            step.values.time = step.context.activity.text.split(' at ')[1];
            
            let query2 = `select bus_number, available_seats from bus where `;
            query2 += `(from_city='${step.values.from}' and to_city='${step.values.to}') `;
            query2 += `and (bus_name='${step.values.busName}' and bus_date='${step.values.journeyDate}') and bus_time='${step.values.time}'`;
            const data = await pool.execute(query2);
            step.values.busNumber = data[0][0].bus_number;
            step.values.seats = data[0][0].available_seats;
            
            const bus = step.values;

            let msg = `Departure location: ${ bus.from }\r\n`;
            msg += `Arrival location: ${bus.to}\r\n`;
            msg += `Number of passenger(s): ${ bus.passengers }\r\n`;
            msg += `Date of journey: ${ bus.journeyDate}\r\n`
            msg += `Bus: ${ bus.busName }\r\n`;
            msg += `Time: ${bus.time}`
            await step.context.sendActivity(msg);

            return await step.prompt(CONFIRM_PROMPT, 'Do you wish to book your ticket?', ['yes', 'no']);
        }
        catch(err) {
            await step.context.sendActivity('Server side error! Please try again or come back later.');
            return await step.replaceDialog('root');
        }
    }

    async summaryStep(step) {
        try{
            if(step.result) {

                //updating remaining seats in the database
                const remainingSeats = step.values.seats - step.values.passengers;
                let query3 = `update bus set available_seats=${remainingSeats} where `;
                query3 += `(from_city='${step.values.from}' and to_city='${step.values.to}') `;
                query3 += `and (bus_name='${step.values.busName}' and bus_date='${step.values.journeyDate}') and bus_time='${step.values.time}'`;
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

                const bus = step.values;
                bus.seats = seatNumbers;
                
                //inserting ticket info into database
                let query4 = `insert into tickets(from_city, to_city, transport_mode, transport_name, travel_time, travel_date, seat_numbers) `;
                query4 += `values('${bus.from}', '${bus.to}', 'BUS', '${bus.busName}', '${bus.time}', '${bus.journeyDate}', '${bus.seats}')`
                await pool.execute(query4);

                //getting ticket id
                let query5 = `select id from tickets where `;
                query5 += `(from_city='${bus.from}' and to_city='${bus.to}') `;
                query5 += `and (transport_mode='BUS' and transport_name='${bus.busName}') and (travel_time='${bus.time}' and travel_date='${bus.journeyDate}') `;
                query5 += `and seat_numbers='${bus.seats}'`
                const data = await pool.execute(query5);
                bus.id = data[0][0].id;

                //Returning Adaptive card of user info
                busCard.body[2].columns[1].items[0].text = bus.id.toString();
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
                // WaterfallStep always finishes with the end of the Waterfall or with another dialog; here it is the end.
                return await step.endDialog();
            }
            await step.context.sendActivity('You did not confirm booking.');
            return await step.replaceDialog('root');
        }
        catch(err) {
            await step.context.sendActivity('Server side error! Please try again or come back later.');
            return await step.replaceDialog('root');
        }
    }

    async fromLocationValidator(promptContext) {
        if(promptContext.recognized.succeeded) {
            let input = promptContext.recognized.value;
            input = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
            const query = `select distinct from_city from bus`;
            const result = await pool.execute(query);
            for(let i=0; i<result[0].length; i++) {
                if(input === result[0][i].from_city) {
                    return true;
                }
            }
        }
        return false;
    }

    async toLocationValidator(promptContext) {
        if(promptContext.recognized.succeeded) {
            let input = promptContext.recognized.value;
            input = input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
            const query = `select distinct to_city from bus`;
            const result = await pool.execute(query);
            for(let i=0; i<result[0].length; i++) {
                if(input === result[0][i].to_city) {
                    return true;
                }
            }
        }
        return false;
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