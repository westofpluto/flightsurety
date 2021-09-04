import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        //this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.flights = [];
        this.passengers = [];
	this.appAddress=config.appAddress;
        this.dataAddress=config.dataAddress;
    }

    logErrorOrEvent(error, event, title) {
      if (error) {
          console.log(error);
      } else {
          console.log('**** EVENT ****');
          console.log(title);
          console.log(event.returnValues);
          console.log('---------------');
      }
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;

            //
            // Addresses 1-5 are the airlines
            // NOTE: Only a couple of these (aaccounts[1] and accounts[2]) are registered and funded.
            // This is done in ../server/server.js
            // For demo purposes, I only use accounts[1] (airlines[0])
            //          
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            //
            // Addresses 6-10 are the passengers
            // NOTE: For demonstration purposes I only use passengers[0]
            //            
            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            callback();
        });
    }

    listenForStatusUpdates(callback) {
        this.flightSuretyData.events.FlightStatusUpdated({}, (error, event) => {
            this.logErrorOrEvent(error, event, "FlightStatusUpdated Received in DAPP");
            callback(error, event);
        });
    }

    listenForPassengerPaid(callback) {
        this.flightSuretyData.events.PassengerPaid({}, (error, event) => {
            console.log("INSIDE contract.js, PassengerPaid!");
            this.logErrorOrEvent(error, event, "PassengerPaid");
            callback(error, event);
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(airline,flightId,timestamp,callback) {
        let self = this;
        let payload = {
            airline: airline,
            flightId: flightId,
            timestamp: timestamp
        } 
        self.flightSuretyApp.methods.fetchFlightStatus(payload.airline, payload.flightId, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    buyInsurance(airline,flightId,timestamp,callback) {
        let self = this;
        let value = document.getElementById('insuranceAmt').value;
        if (!value || value <0 || value > 1.0) {
            alert("Must enter an insurance amount between 0-1 ether");
            return;
        }
        let weiValue = self.web3.utils.toWei(value);

        console.log("In buyInsurance"); 
        console.log("airline: "+airline);
        console.log("flightId: "+flightId);
        console.log("timestamp: "+timestamp);
        console.log("weiValue: "+weiValue);
        try {
            self.flightSuretyApp.methods.buyInsurance(airline,flightId,timestamp)
            .send({ 
                from: self.owner, 
                value: weiValue,
                gas: 999999999
             }, (error, result) => {
                callback(error, result);
            });
        } catch(ex) {
            console.log(ex);
        }

    }

    getRegisteredFlights(callback) {
        let self = this;
        self.flightSuretyApp.methods.getRegisteredFlights().call((error, result) => {
            callback(error, result);
        });
    }

    getRegisteredFlightInfo(flightKey,callback) {
        let self = this;
        self.flightSuretyApp.methods.getRegisteredFlightInfo(flightKey).call((error, result) => {
            callback(error, result);
        });
    }

    getSuretyInfo(airline,flightId,timestamp,callback) {
        let self = this;
        self.flightSuretyApp.methods.getSuretyInfo(airline,flightId,timestamp)
            .call({ from: self.owner},(error, result) => {
            console.log("In contract, getSuretyInfo result is ");
            console.log(result);
            callback(error, result);
        });
    }

    withdrawPassengerClaim(airline,flightId,timestamp,callback) {
        let self = this;
        console.log("Inside contract withdrawPassengerClaim");
        console.log("airline: "+airline);
        console.log("flightId: "+flightId);
        console.log("timestamp: "+timestamp);
        self.flightSuretyApp.methods.withdrawPassengerClaim(airline,flightId,timestamp).send(
            {from: self.owner,
             gas: 999999999
            }, (error, result) => {
            callback(error, result);
        });
    }

    withdrawPassengerClaimDirect(airline,flightId,timestamp,callback) {
        let self = this;
        console.log("Inside contract withdrawPassengerClaim");
        console.log("airline: "+airline);
        console.log("flightId: "+flightId);
        console.log("timestamp: "+timestamp);
        self.flightSuretyData.methods.withdrawPassengerClaimDirect(self.owner,airline,flightId,timestamp).send(
            {from: self.owner,
             gas: 999999999
            }, (error, result) => {
            callback(error, result);
        });
    }


}
