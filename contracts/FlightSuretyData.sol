pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    //
    // Keep track of airlines being registered and funded
    // An airline must first register, then fund with 10 ETH
    // An airline cannot fund unless it is already registered
    // If an airline gets degregistered, it is considered not funded either
    // In other words, an airline can be "registered and not yet funded", but can 
    // never be "funded and not registered"
    // An airline can only participate in the contract (including registering other airlines)
    // if it is both registered and funded. If it is registered but not yet funded, all it can do is
    // fund itself.
    //

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint256 private constant MIN_AIRLINE_FUNDING = 10 ether;
    uint256 private constant MAX_INSURANCE_PREMIUM = 1 ether;
    uint256 private constant INSURANCE_PAYOUT_NUMERATOR = 15;
    uint256 private constant INSURANCE_PAYOUT_DENOMINATOR = 10;

    struct Airline {
        address account;
        bool isRegistered;
        bool isFunded;
        uint256 amount;    // amount of funding
    }

    //
    // A Flight is uniquely identified by the airline address, flightId, and timestamp
    // This is hashed to get flightKey, which is the unique identifier
    //
    struct Flight {
        bool isRegistered;
        address airline;
        string flightId;
        uint256 timestamp;
        uint8 statusCode;
        bool insurancePayable;  // starts as false, set to true if we determine that the flight is delayed
        bool insurancePaid;     // starts as false, set to true after we have paid all insurees  
    }

    struct InsuredFlightPassenger {
        address passenger;
        bytes32 flightKey;
        uint256 amount;
        bool insurancePaid;   // starts as false, set to true when the flight.insurancePayable is true and the contract 
                              // has paid the insurance to this passenger
    }

    mapping(address => Airline) private airlines;     
    uint private numRegistered = 0;
    uint private numFunded = 0;

    // mapping of flights, indexed by flightKey
    mapping(bytes32 => Flight) private flights; 
    bytes32 [] private registeredFlights;

    // mapping of people who bought flight insurance for this flight, indexed by flightKey and passenger address 
    mapping(bytes32 => mapping(address => InsuredFlightPassenger)) private insuredFlightPassengers;
    // mapping of passenger addresses on flight. We need this so we can loop through all passenger and credit them if flight delayed
    mapping(bytes32 => address[]) private insuredFlightPassengerAddresses; 

    //
    // This mapping contains the amount of flight surety payable to a given passenger for a given flight
    //
    mapping(bytes32 => mapping(address => uint256)) flightSurety;
     
    // keep track of multi-airline consensus for registering other airlines
    uint constant MULTI_AIRLINE_CONSENSUS_START = 4;
    mapping(address => address[]) multiCalls;

    mapping(address => uint256) private authorizedAppContracts;

    address private contractOwner;                // Account used to deploy contract
    bool private operational = true;              // Blocks all state changes throughout the contract if false

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event AppContractAuthorized(address appContract); 
    event AppContractDeauthorized(address appContract); 
    event AirlineRegistered(address airline); 
    event AirlineFunded(address airline); 
    event AirlineDeregistered(address airline); 
    event FlightRegistered(address airline, string flightId, uint256 timestamp,bytes32 flightKey); 
    event PassengerBoughtInsurance(address passenger, address airline, string flightId, uint256 timestamp,bytes32 flightKey,uint256 amt); 
    event FlightStatusUpdated(address airline, string flightId, uint256 timestamp,bytes32 flightKey, uint8 statusCode);
    event FlightInsurancePayable(address airline, string flightId, uint256 timestamp,bytes32 flightKey); 
    event PassengerReceivedCredit(address passenger, address airline, string flightId, uint256 timestamp,bytes32 flightKey,uint256 amt); 
    event PassengerPaid(address passenger, address airline, string flightId, uint256 timestamp,bytes32 flightKey,uint256 amt); 
    event FlightInsurancePaid(address airline, string flightId, uint256 timestamp,bytes32 flightKey); 

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) public 
    {
        contractOwner = msg.sender;
        //
        // register first airline. Have to do it explicitly, cannot call external function in constructor
        //
        airlines[firstAirline] = Airline({
            account: firstAirline,
            isRegistered: true,
            isFunded: false,
            amount: 0
        });
        numRegistered++;
        emit AirlineRegistered(firstAirline);
    }

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
        require(operational, "Contract is currently not operational");
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

    modifier airlineIsRegistered(address airline)
    {
        require(airlines[airline].isRegistered, "Caller is not a registered airline");
        _;
    }

    modifier airlineNotYetRegistered(address airline)
    {
        require(!airlines[airline].isRegistered, "Airline is already registered");
        _;
    }

    modifier airlineIsFunded(address airline)
    {
        require(airlines[airline].isFunded, "Airline not yet funded");
        _;
    }

    modifier airlineNotYetFunded(address airline)
    {
        require(!airlines[airline].isFunded, "Airline is already funded");
        _;
    }

    modifier isCallerAuthorized()
    {
        require(authorizedAppContracts[msg.sender] == 1, "Caller is not authorized app contract");
        _;
    }

    modifier flightIsRegistered(bytes32 flightKey)
    {
        require(flights[flightKey].isRegistered, "Flight not yet registered or does not exist");
        _;
    }

    modifier flightIsNotRegistered(bytes32 flightKey)
    {
        require(!flights[flightKey].isRegistered, "Flight already exists");
        _;
    }

    /********************************************************************************************/
    /*                              AIRLINE REGISTRATION FUNCTIONS                              */
    /********************************************************************************************/
    //
    // Called only from authorized app contract
    //
    function registerAirline(address origin, address airline) external 
        requireIsOperational 
        isCallerAuthorized
        airlineNotYetRegistered(airline)
    {
        if (numRegistered==0) {
            // if no airline is registered, then only the data contract owner can register an airline
            require(origin == contractOwner, "Caller is not contract owner");
            airlines[airline] = Airline({
                account: airline,
                isRegistered: true,
                isFunded: false,
                amount: 0
            });
            numRegistered++;
            emit AirlineRegistered(airline);
        } else if (numFunded < MULTI_AIRLINE_CONSENSUS_START) {
            // if fewer than MULTI_AIRLINE_CONSENSUS_START airlines registered and funded, then any registered and funded airline can register another
            require(airlines[origin].isRegistered, "Caller is not a registered airline");
            require(airlines[origin].isFunded, "Caller is registered but not funded airline");
            airlines[airline] = Airline({
                account: airline,
                isRegistered: true,
                isFunded: false,
                amount: 0
            });
            numRegistered++;
            emit AirlineRegistered(airline);
        } else {
            require(airlines[origin].isRegistered, "Caller is not a registered airline");
            require(airlines[origin].isFunded, "Caller is registered but not funded airline");

            // require multiparty consensus to add the given airline
            // multiCalls[airline] will give the array of registered airline addresses that
            // have already voted on the input airline address
            //
            bool isDuplicate=false;
            for (uint i=0;i<multiCalls[airline].length;i++) {
                if (multiCalls[airline][i] == origin) {
                    isDuplicate=true;
                    break;
                }
            }
            require(!isDuplicate, "Caller has already called registerAirline for this airline");

            multiCalls[airline].push(origin);
            // need 50% of registered and funded airlines to vote this airline in
            // make sure we account for the possibility than num registered and funded airlines is odd number
            uint halfNumFunded = (numFunded + numFunded%2)/2;

            if (multiCalls[airline].length == halfNumFunded) {
                airlines[airline] = Airline({
                    account: airline,
                    isRegistered: true,
                    isFunded: false,
                    amount: 0
                });
                numRegistered++;
                delete multiCalls[airline];
                emit AirlineRegistered(airline);
            }
        }
    }

    function getNumRegisteredAirlines() external view
        requireIsOperational isCallerAuthorized
        returns (uint)
    {
        return numRegistered;
    }

    function getNumFundedAirlines() external view
        requireIsOperational isCallerAuthorized
        returns (uint)
    {
        return numFunded;
    }

    function getNumVotesForAirline(address airline) external view
        requireIsOperational isCallerAuthorized
        returns (uint)
    {
        return multiCalls[airline].length;
    }

    /********************************************************************************************/
    /*                              FLIGHT REGISTRATION FUNCTIONS                              */
    /********************************************************************************************/
    function registerFlight(address airline, string flightId, uint256 timestamp, bytes32 flightKey) external 
        requireIsOperational 
        isCallerAuthorized 
        airlineIsRegistered(airline)
        airlineIsFunded(airline)
        flightIsNotRegistered(flightKey)
    {
        flights[flightKey] = Flight({
            isRegistered: true,
            airline: airline,
            flightId: flightId,
            timestamp: timestamp,
            statusCode: 0,
            insurancePayable: false,
            insurancePaid: false
        });
        registeredFlights.push(flightKey);
        emit FlightRegistered(airline,flightId,timestamp,flightKey); 
    }

    function getRegisteredFlights() external view
        requireIsOperational 
        isCallerAuthorized 
        returns (bytes32[])
    {
        return registeredFlights;
    }

    function getRegisteredFlightInfo(bytes32 flightKey) external view
        requireIsOperational 
        isCallerAuthorized 
        flightIsRegistered(flightKey)
        returns (address airline, string memory flightId, uint256 timestamp, 
                 uint8 statusCode, bool insurancePayable, bool insurancePaid)
    {
        require(flights[flightKey].isRegistered, "Flight does not exist");

        airline=flights[flightKey].airline;
        flightId=flights[flightKey].flightId;
        timestamp=flights[flightKey].timestamp;
        statusCode=flights[flightKey].statusCode;
        insurancePayable=flights[flightKey].insurancePayable;
        insurancePaid=flights[flightKey].insurancePaid;
        return (airline,flightId,timestamp,statusCode,insurancePayable,insurancePaid);
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining.
    *      NOTE: An airline can only fund once. Additional funding not allowed or supported.
    *
    */   
    function fundAirline(address airline) external payable
        requireIsOperational 
        isCallerAuthorized 
        airlineIsRegistered(airline)
        airlineNotYetFunded(airline)
    {
        require(msg.value >= MIN_AIRLINE_FUNDING, 
               "Minimum funding amout amount not sent ");
        //contractOwner.transfer(msg.value);
        airlines[airline].isFunded=true;
        airlines[airline].amount = msg.value;
        numFunded++;
        emit AirlineFunded(airline);
    }

    //
    // deregister an airline. When an airline gets deregistered, it gets defunded too, it does not get its funding back
    // This can only be called by the App contract and only by the airline wishing to deregister itself.
    // The App contract does the check to require that the original caller (msg.sender) is the same as the airline 
    //
    function deregisterAirline(address airline) external 
        requireIsOperational 
        isCallerAuthorized
        airlineIsRegistered(airline)
    {
        if (airlines[airline].isFunded) {
            numFunded--;
        }
        delete airlines[airline];
        numRegistered--;
        emit AirlineDeregistered(airline);
    }

    /********************************************************************************************/
    /*                                       AUTH FUNCTIONS                                     */
    /********************************************************************************************/

    function authorizeAppContract(address appContract) public 
        requireContractOwner 
    {
        authorizedAppContracts[appContract] = 1;
        emit AppContractAuthorized(appContract);
    }

    function deauthorizeAppContract(address appContract) public 
        requireContractOwner 
    {
        delete authorizedAppContracts[appContract];
        emit AppContractDeauthorized(appContract);
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() public view returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus ( bool mode) external requireContractOwner 
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buyInsurance(address passenger, address airline, string flightId, uint256 timestamp ) external payable 
        requireIsOperational isCallerAuthorized
    {
        //
        // If the passenger has never bought insurance for this flight, then insuredFlightPassengers[flightId][passenger]
        // will not even exist (will be 0 struct). If this entry exists, then we make sure that the passenger has not already
        // purchased insurance and we also make sure that the passenger does not try to purchase insurance for
        // a flight where insurance is already known to be delayed and payable. 
        //
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(!flights[flightKey].insurancePayable, "cannot buy insurance on a flight already known to be delayed");
        require(insuredFlightPassengers[flightKey][passenger].amount == 0, "passenger already purchased insurance for this flight");    
        require(msg.value <= MAX_INSURANCE_PREMIUM, 
            "Passenger cannot insure flight for more than MAX_INSURANCE_PREMIUM");
        insuredFlightPassengers[flightKey][passenger].passenger = passenger;
        insuredFlightPassengers[flightKey][passenger].flightKey = flightKey;
        insuredFlightPassengers[flightKey][passenger].amount = msg.value;   
        insuredFlightPassengers[flightKey][passenger].insurancePaid = false;

        insuredFlightPassengerAddresses[flightKey].push(passenger);

        //contractOwner.transfer(msg.value);

        emit PassengerBoughtInsurance(passenger,airline,flightId,timestamp,flightKey,msg.value);
    }

    //
    // Called by App contract when we have a valid status code for this flight
    // Pays out insurance if the flight is delayed
    //
    function processFlightStatus(address airline, string flightId, uint256 timestamp, uint8 statusCode) external
        requireIsOperational isCallerAuthorized
    {
        require(airlines[airline].isRegistered, "Airline is not registered, does not exist");
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(flights[flightKey].isRegistered, "Flight does not exist");
        require(flights[flightKey].statusCode == 0, "Status code already set for this flight");
        flights[flightKey].statusCode = statusCode;
        emit FlightStatusUpdated(airline,flightId,timestamp,flightKey,statusCode); 
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            require(!flights[flightKey].insurancePayable, "Insurance is already payable on this flight");
            flights[flightKey].insurancePayable = true;
            emit FlightInsurancePayable(airline,flightId,timestamp,flightKey); 
            creditInsurees(airline,flightId,timestamp);
        }
    }

    function isFlightStatusProcessed(address airline, string flightId, uint256 timestamp) 
        external view
        requireIsOperational isCallerAuthorized
        returns (bool) 
    {
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(flights[flightKey].isRegistered, "Flight does not exist");
        return flights[flightKey].insurancePayable;
    }

    /**
     *  @dev Credits payouts to insurees
    */
    //
    // This function credits all the insurees for this flight
    // It is easiest to do this all at once to know for sure whether insurance has been fully paid on the flight or not
    // Note that is the number of passengers is huge, then we might want a different approach with more sophisticated
    // checking so we don't run out of gas
    //
    function creditInsurees(address airline, string flightId, uint256 timestamp) internal 
        requireIsOperational isCallerAuthorized
    {
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(flights[flightKey].isRegistered, "flight does not exist");
        require(flights[flightKey].insurancePayable, "insurance is not payable on this flight");
        require(!flights[flightKey].insurancePaid, "insurance has already been paid out on this flight");
        uint n=insuredFlightPassengerAddresses[flightKey].length;
        for (uint i=0;i<n;i++) {
            address passenger = insuredFlightPassengerAddresses[flightKey][i];
            if (!insuredFlightPassengers[flightKey][passenger].insurancePaid) {
                uint256 refundAmt = insuredFlightPassengers[flightKey][passenger].amount
                      .mul(INSURANCE_PAYOUT_NUMERATOR).div(INSURANCE_PAYOUT_DENOMINATOR);
                flightSurety[flightKey][passenger] = refundAmt;            
                insuredFlightPassengers[flightKey][passenger].insurancePaid=true;
                emit PassengerReceivedCredit(passenger,airline,flightId,timestamp,flightKey,refundAmt);
            }
        }
        //
        // Finally, set the insurancePaid flag for the flight itself, so no more insurance will be paid
        //
        flights[flightKey].insurancePaid=true;
        emit FlightInsurancePaid(airline,flightId,timestamp,flightKey); 
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function withdrawPassengerClaim(address passenger, address airline, string flightId, uint256 timestamp) external 
        requireIsOperational isCallerAuthorized 
    {
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(flightSurety[flightKey][passenger] > 0, "Passenger is not insured for this flight");
        uint256 amt = flightSurety[flightKey][passenger];
        flightSurety[flightKey][passenger] = 0;
        passenger.transfer(amt);
        emit PassengerPaid(passenger,airline,flightId,timestamp,flightKey,amt);
    }

    function withdrawPassengerClaimDirect(address passenger, address airline, string flightId, uint256 timestamp) external 
        requireIsOperational 
    {
        require(passenger==msg.sender,"Passenger must be msg.sender");
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(flightSurety[flightKey][passenger] > 0, "Passenger is not insured for this flight");
        uint256 amt = flightSurety[flightKey][passenger];
        flightSurety[flightKey][passenger] = 0;
        passenger.transfer(amt);
        emit PassengerPaid(passenger,airline,flightId,timestamp,flightKey,amt);
    }

    function getSuretyInfo(address airline, string flightId, uint256 timestamp, address passenger) view external 
        requireIsOperational isCallerAuthorized 
        returns(uint256 amount)
    {
        bytes32 flightKey = getFlightKey(airline,flightId,timestamp);
        require(flightSurety[flightKey][passenger] > 0, "Passenger is not insured for this flight");
        return flightSurety[flightKey][passenger];
    }

    function getFlightKey ( address airline, string memory flight, uint256 timestamp) pure internal returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function airlineRegistrationFee() pure external returns (uint256) {
        return MIN_AIRLINE_FUNDING;
    }

    /**
    * @dev Fallback function for funding smart contract.
    * NOTE: This only works if sent directly from a registered airline address. The App contract doesn't use this.
    */
    function() external payable 
        requireIsOperational 
    {
        this.fundAirline(msg.sender);
    }


}

