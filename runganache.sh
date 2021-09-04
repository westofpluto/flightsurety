#!/bin/bash
mnemonic=$(<.secret)
ganache-cli --accounts=100 --gasLimit 999999999 --gasPrice 20000000000 -m "$mnemonic"
