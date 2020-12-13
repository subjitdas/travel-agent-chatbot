// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { MessageFactory } = require('botbuilder');
const { ActionTypes } = require('botframework-schema');

const {
    ComponentDialog,
    DialogSet,
    DialogTurnStatus,
    WaterfallDialog
} = require('botbuilder-dialogs');

const { BusDialog } = require('./busDialog');
const { TrainDialog } = require('./trainDialog');
const { PlaneDialog } = require('./planeDialog');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');

class RootDialog extends CancelAndHelpDialog {
    /**
     * SampleBot defines the core business logic of this bot.
     * @param {ConversationState} conversationState A ConversationState object used to store dialog state.
     */
    constructor(userState) {
        super('root');
        // Create a property used to store dialog state.
        // See https://aka.ms/about-bot-state-accessors to learn more about bot state and state accessors.
        this.userStateAccessor = userState.createProperty('result');

        // Add the individual child dialogs and prompts used.
        this.addDialog(new BusDialog('bus', userState));
        this.addDialog(new TrainDialog('train', userState));
        this.addDialog(new PlaneDialog('plane', userState));

        // Finally, add a 2-step WaterfallDialog that will initiate the SlotFillingDialog,
        // and then collect and display the results.
        this.addDialog(new WaterfallDialog('root', [
            this.chooseAction.bind(this),
            this.startDialog.bind(this),
            this.endOfConversation.bind(this)
        ]));

        this.initialDialogId = 'root';
    }

    /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} dialogContext
     */
    async run(context, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        
        const dialogContext = await dialogSet.createContext(context);
        const results = await dialogContext.continueDialog();
        console.log(results.status);
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    async chooseAction(step) {

        const message = await this.sendSuggestedActions();
        await step.context.sendActivity(message);
        return ComponentDialog.EndOfTurn;
    }

    // This is the first step of the WaterfallDialog.
    // then passes the aggregated results on to the next step.
    async startDialog(step) {
        const text = step.context.activity.text;
        if(text.toLowerCase() === 'BUS'.toLowerCase()) {
            return await step.beginDialog('bus');
        }
        else if(text.toLowerCase() === 'TRAIN'.toLowerCase()) {
            return await step.beginDialog('train');
        }
        else if(text.toLowerCase() === 'PLANE'.toLowerCase()) {
            return await step.beginDialog('plane');
        }
        else {
            return await step.replaceDialog('root');
        }
    }

    async endOfConversation(step) {
        await step.context.sendActivity('Thank you for using our services');
        return await step.endDialog();
    }

    async sendSuggestedActions() {
        const cardActions = [
            {
                type: ActionTypes.ImBack,
                title: 'BUS',
                value: 'Bus',
                image: 'http://clipart-library.com/newhp/29-292350_bus-clip-art-png-clip-art-freeuse-library.png',
                imageAltText: 'B'
            },
            {
                type: ActionTypes.ImBack,
                title: 'TRAIN',
                value: 'Train',
                image: 'http://clipart-library.com/images_k/train-clipart-transparent/train-clipart-transparent-11.png',
                imageAltText: 'T'
            },
            {
                type: ActionTypes.ImBack,
                title: 'PLANE',
                value: 'Plane',
                image: 'http://clipart-library.com/img1/1523462.png',
                imageAltText: 'P'
            }
        ];

        let reply = MessageFactory.suggestedActions(cardActions, 'Please select your preferred mode of transportation:');
        return reply;
    }
}

module.exports.RootDialog = RootDialog;
