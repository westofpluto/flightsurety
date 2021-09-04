import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import StatusCodeConfig from './status_code_config.json';
import Web3 from 'web3';
import express from 'express';
require('babel-polyfill');

//
// config file has numOracles and address info
//
let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);


let statusCodeConfig = StatusCodeConfig['localhost'];
let desiredCode = statusCodeConfig.desiredCode;
let probCodeError = statusCodeConfig.probCodeError;
//
// airlines and flights
//
let registeredAirlines = [];
let registeredFlights = [];

//
// The oracles are at addresses in accounts. We need to make sure that we have enough accounts.
// I handle this in truffle config file where I request 50 accounts, so no problem using 20.
//
let numOracles = config.numOracles;
let firstOracle = config.firstOracle;  // first oracle index into accounst
let registeredOracles = [];

let STATUS_CODES = [0, 10, 20, 30, 40, 50];
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

async function setupAndRun() {
    await authorizeAppContract();
    await registerAndFundAirlines();
    await registerFlights();
    await registerOracles();
    await listenForEvents();
}

async function authorizeAppContract() {
    let accounts = await web3.eth.getAccounts();
    let owner = accounts[0];   // this is the account that deployed the app and data contracts

    console.log("Authorizing...");
    await flightSuretyData.methods.authorizeAppContract(config.appAddress).send({
        from: owner,
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: failed to authorize App Contract ");
        } else {
            console.log("App Contract is now authorized");
        }
    });
}

//
// register and fund a couple of airlines, at acoounts 1 and 2
// NOTE: Airline 1 will already be registered upon contract creation, but will not yet be funded
// So, we fund airline 1, then airline 1 registers airline 2, then airline 2 funds itself
//
async function registerAndFundAirlines() {
    let fee = await flightSuretyApp.methods.airlineRegistrationFee().call();
    let accounts = await web3.eth.getAccounts();
    //
    // Fund airline 1
    //
    console.log("Airline 1 is registered, still needs to be funded");
    let airline1 = accounts[1];
    await flightSuretyApp.methods.fundAirline(airline1).send({
        from: airline1,
        value: fee,
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: failed to fund airline 1 at address: "+airline1);
        } else {
            console.log("Airline 1 is now funded");
            registeredAirlines.push(airline1);
        }
    });

/******
    //
    // Let airline 1 register airline 2, then let airline2 fund itself
    //
    let airline2 = accounts[2];
    await flightSuretyApp.methods.registerAirline(airline2).send({
        from: airline1, 
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: airline 1 failed to register airline 2 at address: "+airline2);
        } else {
            console.log("Airline 2 is now registered, still needs to be funded");
        }
    });

    //
    // Now let airline2 fund itself
    //
    await flightSuretyApp.methods.fundAirline(airline2).send({
        from: airline2,
        value: fee,
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: failed to fund airline2 at address: "+airline2);
        } else {
            console.log("Airline 2 is now funded");
            registeredAirlines.push(airline2);
        }
    });
****/
}

//
// Register a few dummy flights for airline1
//
async function registerFlights() {
    let accounts = await web3.eth.getAccounts();

    let airline1 = accounts[1]
    let departureTime1 = new Date(Date.UTC('2021','10','19','12','00','00')).getTime()/1000;   // want it in seconds
    let departureTime2 = new Date(Date.UTC('2021','10','20','15','30','00')).getTime()/1000;   // want it in seconds
    let departureTime3 = new Date(Date.UTC('2021','10','26','19','45','00')).getTime()/1000;   // want it in seconds
    let flightId1= '523';
    let flightId2= '8001';
    let flightId3= '2397';

    await flightSuretyApp.methods.registerFlight(airline1,flightId1,departureTime1).send({
        from: airline1,
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: airline 1 failed to register flight 1 ");
        } else {
            console.log("Flight 1 is now registered");
            registeredFlights.push({airline: airline1, flight: flightId1, timestamp: departureTime1});
        }
    });

    await flightSuretyApp.methods.registerFlight(airline1,flightId2,departureTime2).send({
        from: airline1,
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: airline 1 failed to register flight 2 ");
        } else {
            console.log("Flight 2 is now registered");
            registeredFlights.push({airline: airline1, flight: flightId2, timestamp: departureTime2});
        }
    });

    await flightSuretyApp.methods.registerFlight(airline1,flightId3,departureTime3).send({
        from: airline1,
        gas: 999999999
    }, (error,result) => {
        if (error) {
            console.log("Error: airline 1 failed to register flight 3 ");
        } else {
            console.log("Flight 3 is now registered");
            registeredFlights.push({airline: airline1, flight: flightId3, timestamp: departureTime3});

        }
    });

}

//
// Function to register the oracles
//
async function registerOracles() {
    let regfee = await flightSuretyApp.methods.oracleRegistrationFee().call();
    let accounts = await web3.eth.getAccounts();
    let numAvailableOracleAccounts = accounts.length - firstOracle;
    if (numAvailableOracleAccounts < config.numOracles) {
        numOracles = numAvailableOracleAccounts;  // should never happen
        console.log("WARNING: Using only "+numOracles+" oracles");
    }
    console.log("******  Using "+numOracles+" oracles");

    for (let i = 0; i < numOracles; i++) {
      let oracleAddr = accounts[firstOracle+i];
      await flightSuretyApp.methods.registerOracle().send({
        from: oracleAddr,
        value: regfee,
        gas: 999999999
      }, (error,result) => {
          if (error) {
              console.log("Error: failed to register oracle with index: "+i+" and address: "+oracleAddr);
          } else {
              registeredOracles.push(oracleAddr);
          }
      });
    }
}

//
// listen for events from both App and Data contracts
//
async function listenForEvents() {
    //
    // The OracleRequest event is the main event we care about
    // The rest of the events are mainly used for logging
    //
    flightSuretyApp.events.OracleRequest({fromBlock: 0}, async (error, event)  => {
        logErrorOrEvent(error, event, "OracleRequest");
        if (!error) {
            let index = event.returnValues.index;
            let airline = event.returnValues.airline;
            let flightId = event.returnValues.flightId;
            let timestamp = event.returnValues.timestamp;
            await submitOracleResponse(index,airline,flightId,timestamp);
        }
    });

    flightSuretyApp.events.FlightStatusInfo({}, (error, event) => {
        logErrorOrEvent(error, event, "FlightStatusInfo");
    });
    flightSuretyApp.events.OracleReport({}, (error, event) => {
        logErrorOrEvent(error, event, "OracleReport");
    });
    flightSuretyApp.events.OracleRequest({}, (error, event) => {
        logErrorOrEvent(error, event, "OracleRequest");
    });

    //*************************
    // Data contract events
    //*************************

    flightSuretyData.events.AppContractAuthorized({}, (error, event) => {
        logErrorOrEvent(error, event, "AppContractAuthorized");
    });
    flightSuretyData.events.AppContractDeauthorized({}, (error, event) => {
        logErrorOrEvent(error, event, "AppContractDeuthorized");
    });
    flightSuretyData.events.AirlineRegistered({}, (error, event) => {
        logErrorOrEvent(error, event, "AirlineRegistered");
    });
    flightSuretyData.events.AirlineFunded({}, (error, event) => {
        logErrorOrEvent(error, event, "AirlineFunded");
    });
    flightSuretyData.events.AirlineDeregistered({}, (error, event) => {
        logErrorOrEvent(error, event, "AirlineDeregistered");
    });
    flightSuretyData.events.FlightRegistered({}, (error, event) => {
        logErrorOrEvent(error, event, "FlightRegistered");
    });
    flightSuretyData.events.PassengerBoughtInsurance({}, (error, event) => {
        logErrorOrEvent(error, event, "PassengerBoughtInsurance");
    });
    flightSuretyData.events.FlightStatusUpdated({}, (error, event) => {
        logErrorOrEvent(error, event, "FlightStatusUpdated");
    });
    flightSuretyData.events.FlightInsurancePayable({}, (error, event) => {
        logErrorOrEvent(error, event, "FlightInsurancePayable");
    });
    flightSuretyData.events.PassengerReceivedCredit({}, (error, event) => {
        logErrorOrEvent(error, event, "PassengerReceivedCredit");
    });
    flightSuretyData.events.PassengerPaid({}, (error, event) => {
        logErrorOrEvent(error, event, "PassengerPaid");
    });
    flightSuretyData.events.FlightInsurancePaid({}, (error, event) => {
        logErrorOrEvent(error, event, "FlightInsurancePaid");
    });

}

// ************************************
// ******** RESPONSE FUNCTION ********* 
// ************************************
//
// This function loops over all registered oracles, generates a (random) status code, and sends
// this info to the App contract for the given flight
//
async function submitOracleResponse(index, airline, flightId, timestamp) {
    let n=registeredOracles.length; 
    let statusCode;
    for(let i = 0; i < n; i++) {
        let myIndexes = await flightSuretyApp.methods.getMyIndexes().call({from: registeredOracles[i]});
        if(myIndexes.includes(index)) {
            try {
                //
                // An oracle has a probCodeError (between 0 and 1) of generating a random code
                // Otherwise it generates desiredCode
                //
                if (Math.random() < probCodeError) {
                    //
                    // random code
                    //
                    statusCode = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
                } else {
                    statusCode = desiredCode;
                }
                // 
                // Now send oracle response with statusCode to App contract
                //
                await flightSuretyApp.methods.submitOracleResponse(index, airline, flightId, timestamp, statusCode)
                      .send({from: registeredOracles[i], gas: 9999999});
                console.log("Oracle at " + JSON.stringify(registeredOracles[i]) + " gives statusCode: " + statusCode);
            } catch(ex) {
                console.log(ex);
            }
        }
    }
}

//
// simple logging function
//
function logErrorOrEvent(error, event, title) {
  if (error) console.log(error);
  else {
      console.log('**** EVENT ****');
      console.log(title);
      console.log(event.returnValues);
      console.log('---------------');
  }
}

//*****************************
// Main code: execute funtions
//*****************************
setupAndRun();

const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


