pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSuretyData Smart Contract Interface        */
/************************************************** */
interface FlightSuretyData {

    function registerAirline(address origin, address airline) external;
    function airlineRegistrationFee() external pure returns (uint256);
    function deregisterAirline(address airline) external;
    function fundAirline(address airline) external payable;     
    function getNumRegisteredAirlines() external view returns(uint);
    function getNumFundedAirlines() external view returns(uint);
    function getNumVotesForAirline(address airline) external view returns(uint);
    function registerFlight(address airline, string flightId, uint256 timestamp, bytes32 flightKey) external;
    function getRegisteredFlights() external view returns (bytes32[]);
    function getRegisteredFlightInfo(bytes32 flightKey) external view 
        returns (address, string memory, uint256, uint8, bool, bool);
    function setOperatingStatus ( bool mode) external;
    function buyInsurance(address passenger, address airline, string flightId, uint256 timestamp ) external payable;
    function processFlightStatus(address airline, string flightId, uint256 timestamp, uint8 statusCode) external;
    function isFlightStatusProcessed(address airline, string flightId, uint256 timestamp) 
        external view returns (bool); 

    function withdrawPassengerClaim(address passenger, address airline, string flightId, uint256 timestamp) external;
    function getSuretyInfo(address airline, string flightId, uint256 timestamp, address passenger) 
        view external returns(uint256);
}


/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    // Allow SafeMath functions to be called for all uint256 types 
    // (similar to "prototype" in Javascript)
    using SafeMath for uint256; 

    FlightSuretyData dataContract;
    bool private operational = true;              // Blocks all state changes throughout the contract if false


    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 timestamp;        
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

 
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
         // Modify to call data contract's status
        require(true, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor (address _dataContractAddr) public 
    {
        dataContract = FlightSuretyData(_dataContractAddr);
        contractOwner = msg.sender;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns(bool) 
    {
        return operational;  
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus (bool mode) external requireContractOwner
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/
  
   /**
    * @dev Add an airline to the registration queue
    *
    */   
    function registerAirline(address airline) external 
        requireIsOperational
    {
        dataContract.registerAirline(msg.sender, airline);
    }

    function airlineRegistrationFee() external view returns (uint256)
    {
        return dataContract.airlineRegistrationFee();
    }

    function deregisterAirline(address airline) external 
        requireIsOperational
    {
        require(msg.sender==airline,"Only the airline itself can deregister itself");
        dataContract.deregisterAirline(airline);
    }

    //
    // Forward funds from App contract to data contract.
    // Syntax used: https://ethereum.stackexchange.com/questions/9705/how-can-you-call-a-payable-function-in-another-contract-with-arguments-and-send/9722
    // Note that the syntax changed for more recent versions of Solidity:
    // New synatx would be dataContract.fundAirline(airline){value: msg.value}(airline);
    //
    function fundAirline(address airline) external payable 
        requireIsOperational
    {
        require(msg.sender==airline,"Only the airline itself can fund itself");
        dataContract.fundAirline.value(msg.value)(airline);
    }

    function getNumRegisteredAirlines() external view 
        requireIsOperational
        returns (uint) 
    {
        return dataContract.getNumRegisteredAirlines();
    }

    function getNumFundedAirlines() external view 
        requireIsOperational
        returns (uint) 
    {
        return dataContract.getNumFundedAirlines();
    }

    function getNumVotesForAirline(address airline) external view 
        requireIsOperational
        returns (uint) 
    {
        return dataContract.getNumVotesForAirline(airline);
    }


   /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight(address airline, string flightId, uint256 timestamp) external 
        requireIsOperational 
    {
        require(msg.sender==airline,"Only the airline can register its flights");
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        dataContract.registerFlight(airline,flightId,timestamp,flightKey);
    }

    function getRegisteredFlights() external view 
        requireIsOperational 
        returns (bytes32[]) 
    {
        return dataContract.getRegisteredFlights();
    }
    
    function getRegisteredFlightInfo(bytes32 flightKey) external view 
        requireIsOperational 
        returns (address, string memory, uint256, uint8, bool, bool)  
    {
        return dataContract.getRegisteredFlightInfo(flightKey);
    }

   /**
    * @dev Called after oracle has updated flight status
    *
    */  
    function processFlightStatus(address airline, string flightId, uint256 timestamp, uint8 statusCode)
                                internal
                                requireIsOperational
    {
        dataContract.processFlightStatus(airline, flightId, timestamp, statusCode);
    }


    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus (address airline, string flightId, uint256 timestamp) external
        requireIsOperational
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flightId, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flightId, timestamp);
    } 



    /********************************************************************************************/
    /*                                     PASSENGER FUNCTIONS                                  */
    /********************************************************************************************/
    //
    // Forward funds from App contract to data contract to buy insurance
    // Syntax used: https://ethereum.stackexchange.com/questions/9705/how-can-you-call-a-payable-function-in-another-contract-with-arguments-and-send/9722
    // Note that the syntax changed for more recent versions of Solidity:
    // New synatx would be dataContract.buyInsurance{value: msg.value}(passenger,airline,flightId,timestamp);
    //
    function buyInsurance(address airline, string flightId, uint256 timestamp ) external payable
        requireIsOperational 
    {
        dataContract.buyInsurance.value(msg.value)(msg.sender,airline,flightId,timestamp); 
    }

    //
    // passenger calls this to withdraw funds owed for a late flight
    //
    function withdrawPassengerClaim(address airline, string flightId, uint256 timestamp ) external 
        requireIsOperational 
    {
        dataContract.withdrawPassengerClaim(msg.sender,airline,flightId,timestamp); 
    }

    function getSuretyInfo(address airline, string flightId, uint256 timestamp ) external view
        requireIsOperational 
        returns(uint256)
    {
        return dataContract.getSuretyInfo(airline,flightId,timestamp,msg.sender); 
    }


// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant ORACLE_REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flightId, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flightId, uint256 timestamp, uint8 index, bytes32 key, uint8 status);

    event OracleReport(address airline, string flightId, uint256 timestamp, uint8 status);

    event OracleRegistered(address oracle);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flightId, uint256 timestamp);

    function oracleRegistrationFee() external pure returns (uint256)
    {
        return ORACLE_REGISTRATION_FEE;
    }

    // Register an oracle with the contract
    function registerOracle() external payable
    {
        // Require registration fee
        require(msg.value >= ORACLE_REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });

        //
        // Add an event so we know if/when an oracle is registered
        //
        emit OracleRegistered(msg.sender);
    }

    function getMyIndexes() view external returns(uint8[3])
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse( uint8 index, address airline, string flightId, uint256 timestamp, uint8 statusCode)
        external
    {
        require((oracles[msg.sender].indexes[0] == index) || 
                (oracles[msg.sender].indexes[1] == index) || 
                (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flightId, timestamp)); 
        require(oracleResponses[key].isOpen, "Response no longer open, or flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flightId, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {
            if (oracleResponses[key].isOpen) {
                oracleResponses[key].isOpen = false;
                emit FlightStatusInfo(airline, flightId, timestamp, index, key, statusCode);

                // Handle flight status as appropriate
                processFlightStatus(airline, flightId, timestamp, statusCode);
            }
        }
    }

    function getFlightKey(address airline, string flightId, uint256 timestamp) pure internal returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flightId, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3])
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns random index from 0-9
    function getRandomIndex( address account) internal returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
