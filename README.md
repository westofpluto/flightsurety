# FlightSurety

FlightSurety is a sample application project for Udacity's Blockchain course. This is my implementation for this project.

In the following instructions, all commands are run from the top folder of the project.

## Install

This repository contains Smart Contract code in Solidity (using Truffle), tests (also using Truffle and ganache), dApp scaffolding (using HTML, CSS and JS) and server app scaffolding.

To install, download or clone the repo, then:

`npm install`
`truffle compile`

## Running Tests

To run truffle tests:
First make sur ganache-cli is running:

`./runganache.sh`

Then migrate the contracts and run tests:
`truffle migrate --reset`
`truffle test ./test/flightSurety.js`
`truffle test ./test/oracles.js`

## Running Server and DAPP Demo

To run the demo of the DAPP, do the following:

1. Make sure ganache is running in one window: `./runganache.sh`
2. In a second window, run the truffle migrate command: `truffle migrate --reset`
3. In a third window, run the server: `./runserver.sh`
4. In a fourth window, run the DAPP `./rundapp.sh`
5. Open a browseer to page http://127.0.0.1:8000/
6. Use the DAPP UI.

## Using the DAPP Demo

1. Follow the steps above to get everything running
2. In the UI, click Get Flights to get the list of flights loaded in to the selection dropdown box.
3. Enetr an amount of ether between 0.0 and 1.0 in the Buy Insureance input. Click Buy Insurance. This will purchase insurance for the passenger.
4. Click Get Flight Status. This will launch requests to the oracle and will retunr a flight status. Flight status is displayed with the flight information.
5. Click Collect Surety to demonstrate that the insured passenger can ollect funds if the flight is late.

## Notes     

Note that there is a file called .secret that contains a 12 word mnemonic. You will need
that for the truffle config and for launching the server.

## Resources

* [How does Ethereum work anyway?](https://medium.com/@preethikasireddy/how-does-ethereum-work-anyway-22d1df506369)
* [BIP39 Mnemonic Generator](https://iancoleman.io/bip39/)
* [Truffle Framework](http://truffleframework.com/)
* [Ganache Local Blockchain](http://truffleframework.com/ganache/)
* [Remix Solidity IDE](https://remix.ethereum.org/)
* [Solidity Language Reference](http://solidity.readthedocs.io/en/v0.4.24/)
* [Ethereum Blockchain Explorer](https://etherscan.io/)
* [Web3Js Reference](https://github.com/ethereum/wiki/wiki/JavaScript-API)
