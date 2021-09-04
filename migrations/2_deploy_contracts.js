const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

module.exports = function(deployer, network, accounts) {

    //let firstAirline = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';

    // let firstAirline = '0x4596de5a6cdf720eb54c403b8ea8ccfc992bc168';

    let firstAirline = accounts[1];

    deployer.deploy(FlightSuretyData,firstAirline)
    .then(() => {
        return deployer.deploy(FlightSuretyApp,FlightSuretyData.address)
                .then(() => {
                    let config = {
                        localhost: {
                            url: 'http://localhost:8545',
                            dataAddress: FlightSuretyData.address,
                            appAddress: FlightSuretyApp.address,
                            numOracles: 50,
                            firstOracle: 15
                        }
                    }
                    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                });
    });
}
