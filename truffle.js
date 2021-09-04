var HDWalletProvider = require("truffle-hdwallet-provider");

const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim();


module.exports = {
  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    // development: {
    //   provider: function() {
    //     return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
    //   },
    //   network_id: '*',
    //   gas: 9999999
    // },
    development: {
      //host: "127.0.0.1",     // Localhost (default: none)
      //port: 8545,            // Standard Ethereum port (default: none)
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      },
      network_id: "*",      // Any network (default: none)
      websockets: true
    },
    develop: {
      accounts: 40,
      defaultEtherBalance: 500,
      blockTime: 3
    },

  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};
