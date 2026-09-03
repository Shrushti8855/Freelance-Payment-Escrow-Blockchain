import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.create("localhost");

  const [deployer, client, freelancer, arbitrator] =
    await ethers.getSigners();

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
  console.log("FREELANCE ESCROW WORKFLOW");
  console.log("========================================");

  console.log("\nContract:");
  console.log(contractAddress);

  console.log("\nClient:");
  console.log(client.address);

  console.log("\nFreelancer:");
  console.log(freelancer.address);

  console.log("\nArbitrator:");
  console.log(arbitrator.address);

  // ------------------------------------------------
  // STEP 1
  // ------------------------------------------------

  console.log("\n----------------------------------------");
  console.log("1. CREATE AND FUND ESCROW");
  console.log("----------------------------------------");

  const createTx =
    await escrow
      .connect(client)
      .createEscrow(
        freelancer.address,
        {
          value: amount
        }
      );

  const createReceipt =
    await createTx.wait();

  console.log("Transaction:");
  console.log(createReceipt?.hash);

  let details =
    await escrow.getEscrowDetails(1);

  console.log(
    "Project ID:",
    details[0].toString()
  );

  console.log(
    "Amount:",
    ethers.formatEther(details[3]),
    "ETH"
  );

  console.log(
    "State:",
    details[4].toString()
  );

  console.log(
    "Contract Balance:",
    ethers.formatEther(
      await escrow.getContractBalance()
    ),
    "ETH"
  );

  // ------------------------------------------------
  // STEP 2
  // ------------------------------------------------

  console.log("\n----------------------------------------");
  console.log("2. FREELANCER STARTS WORK");
  console.log("----------------------------------------");

  const startTx =
    await escrow
      .connect(freelancer)
      .startWork(1);

  const startReceipt =
    await startTx.wait();

  console.log("Transaction:");
  console.log(startReceipt?.hash);

  details =
    await escrow.getEscrowDetails(1);

  console.log(
    "State:",
    details[4].toString()
  );

  // ------------------------------------------------
  // STEP 3
  // ------------------------------------------------

  console.log("\n----------------------------------------");
  console.log("3. FREELANCER SUBMITS WORK");
  console.log("----------------------------------------");

  const submitTx =
    await escrow
      .connect(freelancer)
      .submitWork(1);

  const submitReceipt =
    await submitTx.wait();

  console.log("Transaction:");
  console.log(submitReceipt?.hash);

  details =
    await escrow.getEscrowDetails(1);

  console.log(
    "State:",
    details[4].toString()
  );

  // ------------------------------------------------
  // STEP 4
  // ------------------------------------------------

  console.log("\n----------------------------------------");
  console.log("4. CLIENT APPROVES AND RELEASES PAYMENT");
  console.log("----------------------------------------");

  const freelancerBefore =
    await ethers.provider.getBalance(
      freelancer.address
    );

  console.log(
    "Freelancer balance before:",
    ethers.formatEther(
      freelancerBefore
    ),
    "ETH"
  );

  const releaseTx =
    await escrow
      .connect(client)
      .approveAndReleasePayment(1);

  const releaseReceipt =
    await releaseTx.wait();

  console.log("Transaction:");
  console.log(releaseReceipt?.hash);

  const freelancerAfter =
    await ethers.provider.getBalance(
      freelancer.address
    );

  console.log(
    "Freelancer balance after:",
    ethers.formatEther(
      freelancerAfter
    ),
    "ETH"
  );

  details =
    await escrow.getEscrowDetails(1);

  console.log(
    "\nFinal State:",
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
    "Final Contract Balance:",
    ethers.formatEther(
      await escrow.getContractBalance()
    ),
    "ETH"
  );

  console.log("\n========================================");
  console.log("WORKFLOW COMPLETED SUCCESSFULLY");
  console.log("========================================");

  console.log("\nState Transition:");

  console.log(
    "FUNDED → IN_PROGRESS → SUBMITTED → COMPLETED"
  );

  console.log("\nPayment:");
  console.log(
    "1 ETH released to freelancer"
  );

  console.log("\n========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});