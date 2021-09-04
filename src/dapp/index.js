
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

let flights = [];

function ts2datex(timestamp) {
    let date = new Date(timestamp);
    return ""+date.getDate()+"/"+
              (date.getMonth()+1)+"/"+
              date.getFullYear()+ " "+
              date.getHours()+ ":"+
              date.getMinutes();
}

function setFlightStatus(airline,flightId,timestamp,statusCode) {
    for (let i=0;i<flights.length;i++) {
        if (airline==flights[i].airline && 
            flightId==flights[i].flightId && 
            timestamp==flights[i].timestamp) {
            flights[i].statusCode=statusCode;
            break;
        }
    }
    console.log("After setFlightStatus, flight is: ");
    console.log(flights);
}

function ts2date(timestamp) {
    let date = new Date(timestamp);
    return date.toTimeString();  
}

(async() => {

    let result = null;

    let contract = new Contract('localhost', () => {

        // Read transaction
        //contract.isOperational((error, result) => {
        //    console.log(error,result);
        //    display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        //});
    
        // get flights 
        DOM.elid('get-flights').addEventListener('click', () => {
            contract.getRegisteredFlights((error, result) => {
                //console.log(result); 
                flights = [];  
                let ncalls = result.length;   
                for (let i=0;i<result.length;i++) {
                    console.log(i);
                    let flightKey = result[i];
                    contract.getRegisteredFlightInfo(flightKey,(infoerror, inforesult) => {
                        flights.push({
                            airline: inforesult[0],      
                            flightId: inforesult[1],  
                            timestamp: inforesult[2], 
                            statusCode: inforesult[3],   
                            insurancePayable: inforesult[4], 
                            insurancePaid: inforesult[5]   
                        }); 
                        ncalls--;
                        if (ncalls <= 0) {
                            console.log(flights);
                            let selectElt = document.getElementById('flights-selector');
                            //console.log(selectElt);
                            selectElt.options.length=0;
                            console.log("Just before, len = "+flights.length);
                            for (let k=0;k<flights.length;k++) {
                                let opt = document.createElement('option');
                                opt.value = k;
                                opt.innerHTML = "Flight "+flights[k].flightId +", " + ts2date(flights[k].timestamp*1000);
                                selectElt.appendChild(opt);
                                console.log("adding option for "+flights[k]);
                            }
                            selectElt.selectedIndex = 0;
                        }
                    });
                }
            });
        })

        contract.listenForStatusUpdates((error, event) => {
	    console.log("Got result in DAPP, set status in HTML here");            
            console.log(event);
            let airline = event.returnValues.airline;
            let flightId = event.returnValues.flightId;
            let timestamp = event.returnValues.timestamp;
            let statusCode = event.returnValues.statusCode;
            setFlightStatus(airline,flightId,timestamp,statusCode);

            let fltstr = flightId +", " + ts2date(timestamp*1000);
            if (statusCode == 0) {
                fltstr += ": UNKNOWN";
            } else if (statusCode == 10) {
                fltstr += ": ON TIME";
            } else if (statusCode == 20) {
                fltstr += ": DELAYED, PAYABLE";
            } else if (statusCode == 30) {
                fltstr += ": WEATHER DELAY";
            } else if (statusCode == 40) {
                fltstr += ": TECHNICAL DELAY";
            } else {
                fltstr += ": OTHER DELAY";
            }
            show_flight_status('Flight Status', [ { label: 'Flight Status', error: error, value: fltstr} ]);
        });
        
        contract.listenForPassengerPaid((error, event) => {
	    console.log("Received PassengerPaid in DAPP");            
            console.log(event);
            let amt = event.returnValues.amt/1.0E+18;
            alert("Passenger paid "+amt+" for surety");
        });
    
        // User-submitted transaction
        DOM.elid('buyInsurance').addEventListener('click', () => {
            let k = DOM.elid('flights-selector').value;
            console.log("flight selector k is "+k);
            let flight=flights[k];
            console.log(flight);            
            let airline=flight.airline;
            let flightId=flight.flightId;
            let timestamp=flight.timestamp;
            let fltstr = flightId +", " + ts2date(timestamp*1000);
            try{
            contract.buyInsurance(airline,flightId,timestamp,(error, result) => {
                if (error) {
                    console.log(error);
                    alert("Error in buying insurance for owner for flight "+fltstr);
                } else {
                    console.log(result);
                    alert("Owner insured for flight "+fltstr);
                }
            });
            } catch(ex) {
                console.log("Exception: "+ex);
            }
        })
    
        // User-submitted transaction
        DOM.elid('collectSurety').addEventListener('click', () => {
            let k = DOM.elid('flights-selector').value;
            console.log(k);
            let flight=flights[k];
            console.log(flight);            
            let airline=flight.airline;
            let flightId=flight.flightId;
            let timestamp=flight.timestamp;
            let fltstr = flightId +", " + ts2date(timestamp*1000);
            try{
                console.log("BEFORE contract.getSuretyInfo");
                console.log("airline: "+airline);
                console.log("flightId:  "+flightId);
                console.log("timestamp:  "+timestamp);
                contract.getSuretyInfo(airline,flightId,timestamp,(error, result) => {
                    console.log(error);
                    console.log(result);
                    console.log("BEFORE contract.withdrawPassengerClaim");
                    console.log("airline: "+airline);
                    console.log("flightId:  "+flightId);
                    console.log("timestamp:  "+timestamp);
                    contract.withdrawPassengerClaimDirect(airline,flightId,timestamp,(error, result) => {
                        if (error) {
                            console.log(error);
                            alert("Error in collecting surety for flight "+fltstr);
                            if (result) {
                                console.log(result);
                            }
                        } else {
                            console.log(result);
                            //alert("Collected surety for flight "+fltstr);
                        }
                    });
                });
            } catch(ex) {
                console.log("Exception: "+ex);
            }
        })
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let selector = document.getElementById('flights-selector');
            let k = selector.value;
            let flight = flights[k];
            let airline=flight.airline;
            let flightId=flight.flightId;
            let timestamp=flight.timestamp;
            // Write transaction
            contract.fetchFlightStatus(airline,flightId,timestamp,(error, result) => {
                //let fltstr = result.flightId +", " + ts2date(result.timestamp*1000);
                //show_flight_status('Flight Status', [ { label: 'Flight Status', error: error, value: fltstr} ]);
            });
        })
    
    });
    

})();


function show_flight_status(title, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}







