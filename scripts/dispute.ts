import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.create("localhost");

  const [
    deployer,
    client,
    freelancer,
    arbitrator,
  ] = await ethers.getSigners();

  const contractAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const escrow =
    await ethers.getContractAt(
      "FreelanceEscrow",
      contractAddress
    );

  const amount =
    ethers.parseEther("1");

  console.log("========================================");
  console.log("DISPUTE RESOLUTION SIMULATION");
  console.log("========================================");

  console.log("\nContract:");
  console.log(contractAddress);

  console.log("\nClient:");
  console.log(client.address);

  console.log("\nFreelancer:");
  console.log(freelancer.address);

  console.log("\nArbitrator:");
  console.log(arbitrator.address);

  // ==================================================
  // SCENARIO 1
  // DISPUTE → REFUND CLIENT
  // ==================================================

  console.log("\n========================================");
  console.log("SCENARIO 1");
  console.log("DISPUTE → REFUND CLIENT");
  console.log("========================================");

  const projectId1 =
    await escrow.getNextProjectId();

  console.log(
    "\nNew Project ID:",
    projectId1.toString()
  );

  console.log("\n1. Creating escrow...");

  const createTx1 =
    await escrow
      .connect(client)
      .createEscrow(
        freelancer.address,
        {
          value: amount,
        }
      );

  const createReceipt1 =
    await createTx1.wait();

  console.log(
    "Transaction:",
    createReceipt1?.hash
  );

  console.log(
    "Escrow created for Project",
    projectId1.toString()
  );

  console.log("Amount: 1 ETH");

  console.log("\n2. Freelancer starts work...");

  const startTx1 =
    await escrow
      .connect(freelancer)
      .startWork(projectId1);

  const startReceipt1 =
    await startTx1.wait();

  console.log(
    "Transaction:",
    startReceipt1?.hash
  );

  console.log("Work started.");

  console.log("\n3. Freelancer submits work...");

  const submitTx1 =
    await escrow
      .connect(freelancer)
      .submitWork(projectId1);

  const submitReceipt1 =
    await submitTx1.wait();

  console.log(
    "Transaction:",
    submitReceipt1?.hash
  );

  console.log("Work submitted.");

  console.log("\n4. Client raises dispute...");

  const disputeTx1 =
    await escrow
      .connect(client)
      .raiseDispute(projectId1);

  const disputeReceipt1 =
    await disputeTx1.wait();

  console.log(
    "Transaction:",
    disputeReceipt1?.hash
  );

  let details =
    await escrow.getEscrowDetails(projectId1);

  console.log(
    "Escrow State:",
    details[4].toString()
  );

  console.log("Expected State: 6 (DISPUTED)");

  console.log("\n5. Arbitrator resolves dispute...");

  const clientBefore =
    await ethers.provider.getBalance(
      client.address
    );

  const resolveTx1 =
    await escrow
      .connect(arbitrator)
      .resolveDispute(
        projectId1,
        false
      );

  const resolveReceipt1 =
    await resolveTx1.wait();

  console.log(
    "Transaction:",
    resolveReceipt1?.hash
  );

  const clientAfter =
    await ethers.provider.getBalance(
      client.address
    );

  details =
    await escrow.getEscrowDetails(projectId1);

  console.log("\nDispute resolved.");

  console.log(
    "Client balance before:",
    ethers.formatEther(
      clientBefore
    ),
    "ETH"
  );

  console.log(
    "Client balance after:",
    ethers.formatEther(
      clientAfter
    ),
    "ETH"
  );

  console.log(
    "Final State:",
    details[4].toString()
  );

  console.log(
    "Final Escrow Amount:",
    ethers.formatEther(
      details[3]
    ),
    "ETH"
  );

  console.log(
    "Contract Balance:",
    ethers.formatEther(
      await escrow.getContractBalance()
    ),
    "ETH"
  );

  console.log("\nResult:");
  console.log(
    "1 ETH refunded to client."
  );

  // ==================================================
  // SCENARIO 2
  // DISPUTE → RELEASE TO FREELANCER
  // ==================================================

  console.log("\n========================================");
  console.log("SCENARIO 2");
  console.log("DISPUTE → RELEASE TO FREELANCER");
  console.log("========================================");

  const projectId2 =
    await escrow.getNextProjectId();

  console.log(
    "\nNew Project ID:",
    projectId2.toString()
  );

  console.log("\n1. Creating second escrow...");

  const createTx2 =
    await escrow
      .connect(client)
      .createEscrow(
        freelancer.address,
        {
          value: amount,
        }
      );

  const createReceipt2 =
    await createTx2.wait();

  console.log(
    "Transaction:",
    createReceipt2?.hash
  );

  console.log(
    "Escrow created for Project",
    projectId2.toString()
  );

  console.log("Amount: 1 ETH");

  console.log("\n2. Freelancer starts work...");

  const startTx2 =
    await escrow
      .connect(freelancer)
      .startWork(projectId2);

  const startReceipt2 =
    await startTx2.wait();

  console.log(
    "Transaction:",
    startReceipt2?.hash
  );

  console.log("Work started.");

  console.log("\n3. Freelancer submits work...");

  const submitTx2 =
    await escrow
      .connect(freelancer)
      .submitWork(projectId2);

  const submitReceipt2 =
    await submitTx2.wait();

  console.log(
    "Transaction:",
    submitReceipt2?.hash
  );

  console.log("Work submitted.");

  console.log("\n4. Client raises dispute...");

  const disputeTx2 =
    await escrow
      .connect(client)
      .raiseDispute(projectId2);

  const disputeReceipt2 =
    await disputeTx2.wait();

  console.log(
    "Transaction:",
    disputeReceipt2?.hash
  );

  details =
    await escrow.getEscrowDetails(projectId2);

  console.log(
    "Escrow State:",
    details[4].toString()
  );

  console.log("Expected State: 6 (DISPUTED)");

  console.log("\n5. Arbitrator resolves dispute...");

  const freelancerBefore =
    await ethers.provider.getBalance(
      freelancer.address
    );

  const resolveTx2 =
    await escrow
      .connect(arbitrator)
      .resolveDispute(
        projectId2,
        true
      );

  const resolveReceipt2 =
    await resolveTx2.wait();

  console.log(
    "Transaction:",
    resolveReceipt2?.hash
  );

  const freelancerAfter =
    await ethers.provider.getBalance(
      freelancer.address
    );

  details =
    await escrow.getEscrowDetails(projectId2);

  console.log("\nDispute resolved.");

  console.log(
    "Freelancer balance before:",
    ethers.formatEther(
      freelancerBefore
    ),
    "ETH"
  );

  console.log(
    "Freelancer balance after:",
    ethers.formatEther(
      freelancerAfter
    ),
    "ETH"
  );

  console.log(
    "Final State:",
    details[4].toString()
  );

  console.log(
    "Final Escrow Amount:",
    ethers.formatEther(
      details[3]
    ),
    "ETH"
  );

  console.log(
    "Contract Balance:",
    ethers.formatEther(
      await escrow.getContractBalance()
    ),
    "ETH"
  );

  console.log("\nResult:");
  console.log(
    "1 ETH released to freelancer."
  );

  // ==================================================
  // FINAL SUMMARY
  // ==================================================

  console.log("\n========================================");
  console.log("DISPUTE SIMULATION COMPLETED");
  console.log("========================================");

  console.log("\nScenario 1:");
  console.log(
    "FUNDED → IN_PROGRESS → SUBMITTED → DISPUTED → REFUNDED"
  );

  console.log("\nScenario 2:");
  console.log(
    "FUNDED → IN_PROGRESS → SUBMITTED → DISPUTED → COMPLETED"
  );

  console.log("\n========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});