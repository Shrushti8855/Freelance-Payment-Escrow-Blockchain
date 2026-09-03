// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FreelanceEscrow
 * @notice Blockchain-based freelance payment escrow system.
 *
 * Workflow:
 * Client creates and funds escrow
 *        ↓
 * Freelancer starts work
 *        ↓
 * Freelancer submits work
 *        ↓
 * Client approves work
 *        ↓
 * Freelancer receives payment
 *
 * Alternative:
 * Client cancels before work starts → Refund
 * Client or freelancer raises dispute → Arbitrator resolves
 */
contract FreelanceEscrow {

    // =============================================================
    //                           ENUMS
    // =============================================================

    enum EscrowState {
        CREATED,
        FUNDED,
        IN_PROGRESS,
        SUBMITTED,
        COMPLETED,
        CANCELLED,
        DISPUTED,
        REFUNDED
    }

    // =============================================================
    //                           STRUCTS
    // =============================================================

    struct Escrow {
        uint256 projectId;
        address payable client;
        address payable freelancer;
        uint256 amount;
        EscrowState state;
        uint256 createdAt;
    }

    // =============================================================
    //                      STATE VARIABLES
    // =============================================================

    uint256 private nextProjectId = 1;

    address public immutable arbitrator;

    mapping(uint256 => Escrow) private escrows;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event EscrowCreated(
        uint256 indexed projectId,
        address indexed client,
        address indexed freelancer,
        uint256 amount
    );

    event FundsDeposited(
        uint256 indexed projectId,
        address indexed client,
        uint256 amount
    );

    event WorkStarted(
        uint256 indexed projectId,
        address indexed freelancer
    );

    event WorkSubmitted(
        uint256 indexed projectId,
        address indexed freelancer
    );

    event PaymentReleased(
        uint256 indexed projectId,
        address indexed freelancer,
        uint256 amount
    );

    event RefundIssued(
        uint256 indexed projectId,
        address indexed client,
        uint256 amount
    );

    event DisputeRaised(
        uint256 indexed projectId,
        address indexed raisedBy
    );

    event DisputeResolved(
        uint256 indexed projectId,
        bool releasedToFreelancer,
        uint256 amount
    );

    // =============================================================
    //                           MODIFIERS
    // =============================================================

    modifier onlyClient(uint256 projectId) {
        require(
            msg.sender == escrows[projectId].client,
            "Only client can perform this action"
        );
        _;
    }

    modifier onlyFreelancer(uint256 projectId) {
        require(
            msg.sender == escrows[projectId].freelancer,
            "Only freelancer can perform this action"
        );
        _;
    }

    modifier onlyParticipant(uint256 projectId) {
        require(
            msg.sender == escrows[projectId].client ||
            msg.sender == escrows[projectId].freelancer,
            "Only project participants allowed"
        );
        _;
    }

    modifier onlyArbitrator() {
        require(
            msg.sender == arbitrator,
            "Only arbitrator can perform this action"
        );
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /**
     * @param _arbitrator Address responsible for resolving disputes.
     */
    constructor(address _arbitrator) {
        require(
            _arbitrator != address(0),
            "Invalid arbitrator address"
        );

        arbitrator = _arbitrator;
    }

    // =============================================================
    //                      CREATE ESCROW
    // =============================================================

    /**
     * @notice Creates and funds a new freelance escrow.
     * @param _freelancer Wallet address of the freelancer.
     *
     * The client sends ETH together with this transaction.
     */
    function createEscrow(
        address payable _freelancer
    )
        external
        payable
        returns (uint256)
    {
        require(
            _freelancer != address(0),
            "Invalid freelancer address"
        );

        require(
            _freelancer != msg.sender,
            "Client cannot be freelancer"
        );

        require(
            msg.value > 0,
            "Escrow amount must be greater than zero"
        );

        uint256 projectId = nextProjectId;

        escrows[projectId] = Escrow({
            projectId: projectId,
            client: payable(msg.sender),
            freelancer: _freelancer,
            amount: msg.value,
            state: EscrowState.FUNDED,
            createdAt: block.timestamp
        });

        nextProjectId++;

        emit EscrowCreated(
            projectId,
            msg.sender,
            _freelancer,
            msg.value
        );

        emit FundsDeposited(
            projectId,
            msg.sender,
            msg.value
        );

        return projectId;
    }

    // =============================================================
    //                       START WORK
    // =============================================================

    /**
     * @notice Freelancer starts work on a funded project.
     * @param projectId ID of the escrow project.
     */
    function startWork(uint256 projectId)
        external
        onlyFreelancer(projectId)
    {
        require(
            escrows[projectId].state == EscrowState.FUNDED,
            "Escrow must be funded"
        );

        escrows[projectId].state = EscrowState.IN_PROGRESS;

        emit WorkStarted(
            projectId,
            msg.sender
        );
    }

    // =============================================================
    //                      SUBMIT WORK
    // =============================================================

    /**
     * @notice Freelancer submits completed work.
     * @param projectId ID of the escrow project.
     */
    function submitWork(uint256 projectId)
        external
        onlyFreelancer(projectId)
    {
        require(
            escrows[projectId].state == EscrowState.IN_PROGRESS,
            "Work must be in progress"
        );

        escrows[projectId].state = EscrowState.SUBMITTED;

        emit WorkSubmitted(
            projectId,
            msg.sender
        );
    }

    // =============================================================
    //                   APPROVE & RELEASE PAYMENT
    // =============================================================

    /**
     * @notice Client approves submitted work and releases payment.
     * @param projectId ID of the escrow project.
     *
     * Uses Checks-Effects-Interactions pattern.
     */
    function approveAndReleasePayment(uint256 projectId)
        external
        onlyClient(projectId)
    {
        Escrow storage escrow = escrows[projectId];

        require(
            escrow.state == EscrowState.SUBMITTED,
            "Work has not been submitted"
        );

        require(
            escrow.amount > 0,
            "No funds available"
        );

        uint256 payment = escrow.amount;

        // Effects
        escrow.amount = 0;
        escrow.state = EscrowState.COMPLETED;

        // Interaction
        (bool success, ) = escrow.freelancer.call{
            value: payment
        }("");

        require(
            success,
            "Payment transfer failed"
        );

        emit PaymentReleased(
            projectId,
            escrow.freelancer,
            payment
        );
    }

    // =============================================================
    //                       CANCEL & REFUND
    // =============================================================

    /**
     * @notice Client cancels a funded escrow and receives a refund.
     * @param projectId ID of the escrow project.
     */
    function cancelAndRefund(uint256 projectId)
        external
        onlyClient(projectId)
    {
        Escrow storage escrow = escrows[projectId];

        require(
            escrow.state == EscrowState.FUNDED,
            "Escrow cannot be cancelled now"
        );

        require(
            escrow.amount > 0,
            "No funds available"
        );

        uint256 refundAmount = escrow.amount;

        // Effects
        escrow.amount = 0;
        escrow.state = EscrowState.REFUNDED;

        // Interaction
        (bool success, ) = escrow.client.call{
            value: refundAmount
        }("");

        require(
            success,
            "Refund transfer failed"
        );

        emit RefundIssued(
            projectId,
            escrow.client,
            refundAmount
        );
    }

    // =============================================================
    //                       RAISE DISPUTE
    // =============================================================

    /**
     * @notice Client or freelancer raises a dispute.
     * @param projectId ID of the escrow project.
     */
    function raiseDispute(uint256 projectId)
        external
        onlyParticipant(projectId)
    {
        Escrow storage escrow = escrows[projectId];

        require(
            escrow.state == EscrowState.FUNDED ||
            escrow.state == EscrowState.IN_PROGRESS ||
            escrow.state == EscrowState.SUBMITTED,
            "Dispute cannot be raised in current state"
        );

        escrow.state = EscrowState.DISPUTED;

        emit DisputeRaised(
            projectId,
            msg.sender
        );
    }

    // =============================================================
    //                     RESOLVE DISPUTE
    // =============================================================

    /**
     * @notice Arbitrator resolves a disputed escrow.
     * @param projectId ID of the escrow project.
     * @param releaseToFreelancer Whether funds should go to the
     * freelancer. True releases payment to the freelancer;
     * false refunds the client.
     */
    function resolveDispute(
        uint256 projectId,
        bool releaseToFreelancer
    )
        external
        onlyArbitrator
    {
        Escrow storage escrow = escrows[projectId];

        require(
            escrow.state == EscrowState.DISPUTED,
            "Escrow is not disputed"
        );

        require(
            escrow.amount > 0,
            "No funds available"
        );

        uint256 settlementAmount = escrow.amount;

        // Effects
        escrow.amount = 0;

        address payable recipient;

        if (releaseToFreelancer) {
            escrow.state = EscrowState.COMPLETED;
            recipient = escrow.freelancer;
        } else {
            escrow.state = EscrowState.REFUNDED;
            recipient = escrow.client;
        }

        // Interaction
        (bool success, ) = recipient.call{
            value: settlementAmount
        }("");

        require(
            success,
            "Settlement transfer failed"
        );

        emit DisputeResolved(
            projectId,
            releaseToFreelancer,
            settlementAmount
        );
    }

    // =============================================================
    //                     GET ESCROW DETAILS
    // =============================================================

    /**
     * @notice Returns complete escrow information.
     * @param projectId ID of the escrow project.
     */
    function getEscrowDetails(
        uint256 projectId
    )
        external
        view
        returns (
            uint256,
            address,
            address,
            uint256,
            EscrowState,
            uint256
        )
    {
        Escrow memory escrow = escrows[projectId];

        return (
            escrow.projectId,
            escrow.client,
            escrow.freelancer,
            escrow.amount,
            escrow.state,
            escrow.createdAt
        );
    }

    // =============================================================
    //                    CONTRACT BALANCE
    // =============================================================

    /**
     * @notice Returns the ETH currently locked in the contract.
     */
    function getContractBalance()
        external
        view
        returns (uint256)
    {
        return address(this).balance;
    }

    // =============================================================
    //                    NEXT PROJECT ID
    // =============================================================

    /**
     * @notice Returns the ID assigned to the next escrow.
     */
    function getNextProjectId()
        external
        view
        returns (uint256)
    {
        return nextProjectId;
    }
}