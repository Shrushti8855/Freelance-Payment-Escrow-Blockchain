import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const HARDHAT_CHAIN_ID = 31337;

const CONTRACT_ABI = [
  "function createEscrow(address payable _freelancer) external payable returns (uint256)",
  "function startWork(uint256 projectId) external",
  "function submitWork(uint256 projectId) external",
  "function approveAndReleasePayment(uint256 projectId) external",
  "function cancelAndRefund(uint256 projectId) external",
  "function raiseDispute(uint256 projectId) external",
  "function resolveDispute(uint256 projectId, bool releaseToFreelancer) external",
  "function getEscrowDetails(uint256 projectId) external view returns (uint256,address,address,uint256,uint8,uint256)",
  "function getContractBalance() external view returns (uint256)",
  "function getNextProjectId() external view returns (uint256)",
  "function arbitrator() external view returns (address)"
];

const STATES = [
  "CREATED",
  "FUNDED",
  "IN_PROGRESS",
  "SUBMITTED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED"
];

function App() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);

  const [freelancerAddress, setFreelancerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState("");
  const [escrow, setEscrow] = useState(null);

  const [message, setMessage] = useState(
    "Connect your wallet to start."
  );

  const [loading, setLoading] = useState(false);

  // --------------------------------------------------
  // ERROR HANDLER
  // --------------------------------------------------

  function getErrorMessage(error) {
    console.error("Blockchain Error:", error);

    return (
      error?.reason ||
      error?.shortMessage ||
      error?.info?.error?.message ||
      error?.data?.message ||
      error?.message ||
      "Transaction failed."
    );
  }

  // --------------------------------------------------
  // CONNECT / UPDATE WALLET
  // --------------------------------------------------

  async function setupWallet(address) {
    try {
      if (!window.ethereum) {
        setMessage("MetaMask is not installed.");
        return;
      }

      const browserProvider =
        new ethers.BrowserProvider(window.ethereum);

      const network = await browserProvider.getNetwork();

      if (Number(network.chainId) !== HARDHAT_CHAIN_ID) {
        setMessage(
          `Wrong network. Please switch MetaMask to Hardhat Local (Chain ID ${HARDHAT_CHAIN_ID}).`
        );
        return;
      }

      const walletSigner =
        await browserProvider.getSigner(address);

      const walletAddress =
        await walletSigner.getAddress();

      const escrowContract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          walletSigner
        );

      setProvider(browserProvider);
      setSigner(walletSigner);
      setAccount(walletAddress);
      setContract(escrowContract);

      setMessage(
        `Wallet connected: ${walletAddress.slice(
          0,
          6
        )}...${walletAddress.slice(-4)}`
      );

      return escrowContract;
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setMessage("MetaMask is not installed.");
        return;
      }

      const browserProvider =
        new ethers.BrowserProvider(window.ethereum);

      const accounts =
        await browserProvider.send(
          "eth_requestAccounts",
          []
        );

      if (!accounts || accounts.length === 0) {
        setMessage("No MetaMask account found.");
        return;
      }

      await setupWallet(accounts[0]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  // --------------------------------------------------
  // META MASK ACCOUNT / NETWORK CHANGES
  // --------------------------------------------------

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        setAccount("");
        setSigner(null);
        setContract(null);
        setMessage("Wallet disconnected.");
        return;
      }

      await setupWallet(accounts[0]);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on(
      "accountsChanged",
      handleAccountsChanged
    );

    window.ethereum.on(
      "chainChanged",
      handleChainChanged
    );

    return () => {
      window.ethereum.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );

      window.ethereum.removeListener(
        "chainChanged",
        handleChainChanged
      );
    };
  }, []);

  // --------------------------------------------------
  // CREATE ESCROW
  // --------------------------------------------------

  async function createEscrow() {
    try {
      if (!contract) {
        setMessage("Connect your wallet first.");
        return;
      }

      if (!freelancerAddress || !amount) {
        setMessage(
          "Enter freelancer address and escrow amount."
        );
        return;
      }

      if (!ethers.isAddress(freelancerAddress)) {
        setMessage("Invalid freelancer address.");
        return;
      }

      if (Number(amount) <= 0) {
        setMessage(
          "Escrow amount must be greater than zero."
        );
        return;
      }

      if (
        freelancerAddress.toLowerCase() ===
        account.toLowerCase()
      ) {
        setMessage(
          "Client and freelancer must be different wallets."
        );
        return;
      }

      setLoading(true);
      setMessage("Creating and funding escrow...");

      const transaction =
        await contract.createEscrow(
          freelancerAddress,
          {
            value: ethers.parseEther(amount)
          }
        );

      setMessage(
        "Transaction submitted. Waiting for confirmation..."
      );

      await transaction.wait();

      const nextId =
        await contract.getNextProjectId();

      const createdId =
        Number(nextId) - 1;

      setProjectId(String(createdId));
      setAmount("");

      setMessage(
        `Escrow Project #${createdId} created successfully.`
      );

      await getEscrow(createdId);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // GET ESCROW
  // --------------------------------------------------

  async function getEscrow(id = projectId) {
    try {
      if (!contract) {
        setMessage("Connect your wallet first.");
        return;
      }

      if (!id) {
        setMessage("Enter a project ID.");
        return;
      }

      if (Number(id) <= 0) {
        setMessage("Project ID must be greater than zero.");
        return;
      }

      setLoading(true);
      setMessage("Loading escrow details...");

      const data =
        await contract.getEscrowDetails(id);

      const loadedEscrow = {
        projectId: data[0].toString(),
        client: data[1],
        freelancer: data[2],
        amount: ethers.formatEther(data[3]),
        state: Number(data[4]),
        createdAt: new Date(
          Number(data[5]) * 1000
        ).toLocaleString()
      };

      setEscrow(loadedEscrow);

      setMessage(
        `Project #${loadedEscrow.projectId} loaded: ${
          STATES[loadedEscrow.state]
        }`
      );
    } catch (error) {
      setEscrow(null);
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // ROLE HELPERS
  // --------------------------------------------------

  function isClient() {
    return (
      escrow &&
      account &&
      escrow.client.toLowerCase() ===
        account.toLowerCase()
    );
  }

  function isFreelancer() {
    return (
      escrow &&
      account &&
      escrow.freelancer.toLowerCase() ===
        account.toLowerCase()
    );
  }

  function isArbitrator() {
    return (
      escrow &&
      account &&
      escrow.arbitrator &&
      escrow.arbitrator.toLowerCase() ===
        account.toLowerCase()
    );
  }

  // --------------------------------------------------
  // GENERIC ACTION
  // --------------------------------------------------

  async function executeAction(
    action,
    successMessage
  ) {
    try {
      if (!window.ethereum) {
        setMessage("MetaMask is not installed.");
        return;
      }

      if (!account) {
        setMessage("Connect your wallet first.");
        return;
      }

      if (!projectId) {
        setMessage("Enter a project ID.");
        return;
      }

      if (!escrow) {
        setMessage(
          "Load the escrow details before performing an action."
        );
        return;
      }

      if (!provider) {
        setMessage(
          "Wallet provider unavailable. Reconnect MetaMask."
        );
        return;
      }

      setLoading(true);
      setMessage("Checking wallet and transaction...");

      // Always get the CURRENT MetaMask account.
      const accounts =
        await provider.send(
          "eth_accounts",
          []
        );

      if (
        !accounts.length ||
        accounts[0].toLowerCase() !==
          account.toLowerCase()
      ) {
        setMessage(
          "MetaMask account changed. Please reconnect your wallet."
        );
        return;
      }

      // Get a fresh signer every time.
      const freshSigner =
        await provider.getSigner(accounts[0]);

      const freshContract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          freshSigner
        );

      setMessage(
        "Please confirm the transaction in MetaMask..."
      );

      const transaction =
        await action(
          freshContract,
          projectId
        );

      setMessage(
        "Transaction submitted. Waiting for confirmation..."
      );

      await transaction.wait();

      setMessage(successMessage);

      await getEscrow(projectId);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // START WORK
  // --------------------------------------------------

  async function startWork() {
    if (!escrow) {
      setMessage("Load an escrow first.");
      return;
    }

    if (escrow.state !== 1) {
      setMessage(
        `Start Work is unavailable because the escrow is ${STATES[escrow.state]}.`
      );
      return;
    }

    if (!isFreelancer()) {
      setMessage(
        "Only the Freelancer can start the work."
      );
      return;
    }

    await executeAction(
      (currentContract, id) =>
        currentContract.startWork(id),
      "Work started successfully."
    );
  }

  // --------------------------------------------------
  // SUBMIT WORK
  // --------------------------------------------------

  async function submitWork() {
    if (!escrow) {
      setMessage("Load an escrow first.");
      return;
    }

    if (escrow.state !== 2) {
      setMessage(
        `Submit Work is unavailable because the escrow is ${STATES[escrow.state]}.`
      );
      return;
    }

    if (!isFreelancer()) {
      setMessage(
        "Only the Freelancer can submit the work."
      );
      return;
    }

    await executeAction(
      (currentContract, id) =>
        currentContract.submitWork(id),
      "Work submitted successfully."
    );
  }

  // --------------------------------------------------
  // APPROVE PAYMENT
  // --------------------------------------------------

  async function approvePayment() {
    if (!escrow) {
      setMessage("Load an escrow first.");
      return;
    }

    if (escrow.state !== 3) {
      setMessage(
        `Payment release is unavailable because the escrow is ${STATES[escrow.state]}.`
      );
      return;
    }

    if (!isClient()) {
      setMessage(
        "Only the Client can approve and release payment."
      );
      return;
    }

    await executeAction(
      (currentContract, id) =>
        currentContract.approveAndReleasePayment(id),
      "Payment released to freelancer."
    );
  }

  // --------------------------------------------------
  // CANCEL / REFUND
  // --------------------------------------------------

  async function cancelRefund() {
    if (!escrow) {
      setMessage("Load an escrow first.");
      return;
    }

    if (escrow.state !== 1) {
      setMessage(
        `Cancellation is unavailable because the escrow is ${STATES[escrow.state]}.`
      );
      return;
    }

    if (!isClient()) {
      setMessage(
        "Only the Client can cancel the escrow."
      );
      return;
    }

    await executeAction(
      (currentContract, id) =>
        currentContract.cancelAndRefund(id),
      "Escrow refunded to client."
    );
  }

  // --------------------------------------------------
  // RAISE DISPUTE
  // --------------------------------------------------

  async function raiseDispute() {
    if (!escrow) {
      setMessage("Load an escrow first.");
      return;
    }

    if (
      ![1, 2, 3].includes(escrow.state)
    ) {
      setMessage(
        `A dispute cannot be raised when the escrow is ${STATES[escrow.state]}.`
      );
      return;
    }

    if (!isClient() && !isFreelancer()) {
      setMessage(
        "Only the Client or Freelancer can raise a dispute."
      );
      return;
    }

    await executeAction(
      (currentContract, id) =>
        currentContract.raiseDispute(id),
      "Dispute raised successfully."
    );
  }

  // --------------------------------------------------
  // RESOLVE DISPUTE
  // --------------------------------------------------

  async function resolveDispute(
    releaseToFreelancer
  ) {
    if (!escrow) {
      setMessage("Load an escrow first.");
      return;
    }

    if (escrow.state !== 6) {
      setMessage(
        `This escrow is not disputed. Current state: ${STATES[escrow.state]}`
      );
      return;
    }

    setLoading(true);

    try {
      if (!provider) {
        setMessage(
          "Wallet provider unavailable. Reconnect MetaMask."
        );
        return;
      }

      const accounts =
        await provider.send(
          "eth_accounts",
          []
        );

      if (!accounts.length) {
        setMessage(
          "No connected MetaMask account."
        );
        return;
      }

      const currentAddress =
        accounts[0];

      // Read arbitrator directly from blockchain.
      const readContract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

      const arbitratorAddress =
        await readContract.arbitrator();

      if (
        currentAddress.toLowerCase() !==
        arbitratorAddress.toLowerCase()
      ) {
        setMessage(
          "Only the authorized Arbitrator can resolve this dispute."
        );
        return;
      }

      const freshSigner =
        await provider.getSigner(
          currentAddress
        );

      const freshContract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          freshSigner
        );

      setMessage(
        "Please confirm the dispute resolution in MetaMask..."
      );

      const transaction =
        await freshContract.resolveDispute(
          projectId,
          releaseToFreelancer
        );

      setMessage(
        "Transaction submitted. Waiting for confirmation..."
      );

      await transaction.wait();

      setMessage(
        releaseToFreelancer
          ? "Payment released to freelancer."
          : "Funds refunded to client."
      );

      await getEscrow(projectId);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CURRENT STATE
  // --------------------------------------------------

  const currentState =
    escrow
      ? STATES[escrow.state]
      : "NO ESCROW";

  // --------------------------------------------------
  // BUTTON STATES
  // --------------------------------------------------

  const canStartWork =
    escrow &&
    escrow.state === 1 &&
    isFreelancer();

  const canSubmitWork =
    escrow &&
    escrow.state === 2 &&
    isFreelancer();

  const canApprove =
    escrow &&
    escrow.state === 3 &&
    isClient();

  const canCancel =
    escrow &&
    escrow.state === 1 &&
    isClient();

  const canRaiseDispute =
    escrow &&
    [1, 2, 3].includes(escrow.state) &&
    (isClient() || isFreelancer());

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app">

      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            ◆
          </div>

          <div>
            <h1>FreelanceEscrow</h1>
            <p>Blockchain Payment Protection</p>
          </div>
        </div>

        <button
          className="connect-button"
          onClick={connectWallet}
        >
          {account
            ? `${account.slice(
                0,
                6
              )}...${account.slice(-4)}`
            : "Connect Wallet"}
        </button>
      </header>

      <main className="container">

        <section className="hero">
          <div>
            <p className="eyebrow">
              DECENTRALIZED FREELANCE PAYMENTS
            </p>

            <h2>
              Secure payments.
              <br />
              <span>
                Trustless delivery.
              </span>
            </h2>

            <p className="hero-text">
              Protect freelance payments with
              blockchain-powered escrow,
              transparent project states,
              and decentralized dispute
              resolution.
            </p>
          </div>

          <div className="hero-card">
            <div className="shield">
              ◇
            </div>

            <p>
              Smart Contract Protected
            </p>

            <strong>
              100% On-Chain Settlement
            </strong>
          </div>
        </section>

        <div className="status-bar">
          <span className="status-dot"></span>
          {message}
        </div>

        <section className="grid">

          {/* CREATE ESCROW */}

          <div className="card create-card">

            <div className="card-heading">
              <div>
                <span className="card-number">
                  01
                </span>

                <h3>
                  Create Escrow
                </h3>
              </div>

              <span className="badge">
                CLIENT
              </span>
            </div>

            <p className="description">
              Deposit funds into a smart
              contract for a freelance project.
            </p>

            <label>
              Freelancer Wallet Address
            </label>

            <input
              type="text"
              placeholder="0x..."
              value={freelancerAddress}
              onChange={(e) =>
                setFreelancerAddress(
                  e.target.value
                )
              }
            />

            <label>
              Escrow Amount
            </label>

            <div className="input-with-unit">

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="1.0"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
              />

              <span>
                ETH
              </span>

            </div>

            <button
              className="primary-button"
              onClick={createEscrow}
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : "Create & Fund Escrow"}
            </button>

          </div>

          {/* VIEW ESCROW */}

          <div className="card lookup-card">

            <div className="card-heading">

              <div>
                <span className="card-number">
                  02
                </span>

                <h3>
                  View Escrow
                </h3>
              </div>

              <span className="badge blue">
                ON-CHAIN
              </span>

            </div>

            <p className="description">
              Retrieve transparent project
              information directly from the
              blockchain.
            </p>

            <label>
              Project ID
            </label>

            <input
              type="number"
              min="1"
              placeholder="1"
              value={projectId}
              onChange={(e) =>
                setProjectId(
                  e.target.value
                )
              }
            />

            <button
              className="secondary-button"
              onClick={() =>
                getEscrow()
              }
              disabled={loading}
            >
              Load Escrow Details
            </button>

            {escrow && (
              <div className="escrow-details">

                <div className="detail-row">
                  <span>
                    Project
                  </span>

                  <strong>
                    #{escrow.projectId}
                  </strong>
                </div>

                <div className="detail-row">
                  <span>
                    Amount
                  </span>

                  <strong>
                    {escrow.amount} ETH
                  </strong>
                </div>

                <div className="detail-row">
                  <span>
                    Status
                  </span>

                  <strong className="state">
                    {currentState}
                  </strong>
                </div>

                <div className="address-block">
                  <span>
                    Client
                  </span>

                  <small>
                    {escrow.client}
                  </small>
                </div>

                <div className="address-block">
                  <span>
                    Freelancer
                  </span>

                  <small>
                    {escrow.freelancer}
                  </small>
                </div>

                <div className="address-block">
                  <span>
                    Created
                  </span>

                  <small>
                    {escrow.createdAt}
                  </small>
                </div>

              </div>
            )}

          </div>

        </section>

        {/* WORKFLOW */}

        <section className="card workflow-card">

          <div className="card-heading">
            <div>
              <span className="card-number">
                03
              </span>

              <h3>
                Escrow Workflow
              </h3>
            </div>
          </div>

          <div className="workflow">

            <div
              className={`step ${
                escrow?.state >= 1
                  ? "active"
                  : ""
              }`}
            >
              <span>1</span>
              <strong>
                FUNDED
              </strong>
              <small>
                Client deposits
              </small>
            </div>

            <div
              className={`line ${
                escrow?.state >= 2
                  ? "active"
                  : ""
              }`}
            ></div>

            <div
              className={`step ${
                escrow?.state >= 2
                  ? "active"
                  : ""
              }`}
            >
              <span>2</span>
              <strong>
                IN PROGRESS
              </strong>
              <small>
                Freelancer works
              </small>
            </div>

            <div
              className={`line ${
                escrow?.state >= 3
                  ? "active"
                  : ""
              }`}
            ></div>

            <div
              className={`step ${
                escrow?.state >= 3
                  ? "active"
                  : ""
              }`}
            >
              <span>3</span>
              <strong>
                SUBMITTED
              </strong>
              <small>
                Work delivered
              </small>
            </div>

            <div
              className={`line ${
                escrow?.state >= 4
                  ? "active"
                  : ""
              }`}
            ></div>

            <div
              className={`step ${
                escrow?.state === 4
                  ? "active"
                  : ""
              }`}
            >
              <span>4</span>
              <strong>
                COMPLETED
              </strong>
              <small>
                Payment released
              </small>
            </div>

          </div>

        </section>

        {/* ACTIONS */}

        <section className="card actions-card">

          <div className="card-heading">

            <div>
              <span className="card-number">
                04
              </span>

              <h3>
                Project Actions
              </h3>
            </div>

            {escrow && (
              <span className="current-state">
                Current: {currentState}
              </span>
            )}

          </div>

          <div className="actions">

            <button
              onClick={startWork}
              disabled={
                !canStartWork ||
                loading
              }
              title={
                !escrow
                  ? "Load an escrow first"
                  : escrow.state !== 1
                  ? "Escrow must be FUNDED"
                  : !isFreelancer()
                  ? "Only the freelancer can start work"
                  : ""
              }
            >
              ▶ Start Work
            </button>

            <button
              onClick={submitWork}
              disabled={
                !canSubmitWork ||
                loading
              }
              title={
                !escrow
                  ? "Load an escrow first"
                  : escrow.state !== 2
                  ? "Escrow must be IN_PROGRESS"
                  : !isFreelancer()
                  ? "Only the freelancer can submit work"
                  : ""
              }
            >
              ↗ Submit Work
            </button>

            <button
              className="success"
              onClick={approvePayment}
              disabled={
                !canApprove ||
                loading
              }
              title={
                !escrow
                  ? "Load an escrow first"
                  : escrow.state !== 3
                  ? "Escrow must be SUBMITTED"
                  : !isClient()
                  ? "Only the client can release payment"
                  : ""
              }
            >
              ✓ Approve & Release
            </button>

            <button
              onClick={cancelRefund}
              disabled={
                !canCancel ||
                loading
              }
              title={
                !escrow
                  ? "Load an escrow first"
                  : escrow.state !== 1
                  ? "Only FUNDED escrow can be cancelled"
                  : !isClient()
                  ? "Only the client can cancel"
                  : ""
              }
            >
              ↩ Cancel & Refund
            </button>

            <button
              className="warning"
              onClick={raiseDispute}
              disabled={
                !canRaiseDispute ||
                loading
              }
              title={
                !escrow
                  ? "Load an escrow first"
                  : ![1, 2, 3].includes(
                      escrow.state
                    )
                  ? "Dispute unavailable in this state"
                  : ""
              }
            >
              ⚠ Raise Dispute
            </button>

            <button
              className="danger"
              onClick={() =>
                resolveDispute(false)
              }
              disabled={
                !escrow ||
                escrow.state !== 6 ||
                loading
              }
              title="Only the arbitrator can resolve a dispute"
            >
              ⚖ Refund Client
            </button>

            <button
              className="success"
              onClick={() =>
                resolveDispute(true)
              }
              disabled={
                !escrow ||
                escrow.state !== 6 ||
                loading
              }
              title="Only the arbitrator can resolve a dispute"
            >
              ⚖ Release to Freelancer
            </button>

          </div>

        </section>

        {/* INFO */}

        <section className="info-grid">

          <div className="info-card">
            <span>
              🔐
            </span>

            <h4>
              Trustless Escrow
            </h4>

            <p>
              Funds are held by the smart
              contract instead of a centralized
              intermediary.
            </p>
          </div>

          <div className="info-card">
            <span>
              ⚡
            </span>

            <h4>
              Transparent States
            </h4>

            <p>
              Every project transition is
              recorded and verifiable on-chain.
            </p>
          </div>

          <div className="info-card">
            <span>
              ⚖
            </span>

            <h4>
              Dispute Resolution
            </h4>

            <p>
              An authorized arbitrator can
              resolve disputes and settle escrow
              funds.
            </p>
          </div>

        </section>

      </main>

      <footer>
        <p>
          FreelanceEscrow · Built with React,
          Ethers.js, Solidity & Hardhat
        </p>
      </footer>

    </div>
  );
}

export default App;