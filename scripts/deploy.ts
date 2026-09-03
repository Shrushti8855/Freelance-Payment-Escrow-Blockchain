import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.create("localhost");

  const [deployer, client, freelancer, arbitrator] =
    await ethers.getSigners();

  console.log("========================================");
  console.log("Freelance Payment Escrow Deployment");
  console.log("========================================");

  console.log("\nDeployer:");
  console.log(deployer.address);

  console.log("\nClient:");
  console.log(client.address);

  console.log("\nFreelancer:");
  console.log(freelancer.address);

  console.log("\nArbitrator:");
  console.log(arbitrator.address);

  console.log("\nDeploying FreelanceEscrow...");

  const FreelanceEscrow =
    await ethers.getContractFactory("FreelanceEscrow");

  const escrow = await FreelanceEscrow.deploy(
    arbitrator.address
  );

  await escrow.waitForDeployment();

  const contractAddress =
    await escrow.getAddress();

  console.log("\n========================================");
  console.log("Deployment Successful");
  console.log("========================================");

  console.log("\nFreelanceEscrow Address:");
  console.log(contractAddress);

  console.log("\nArbitrator stored in contract:");
  console.log(await escrow.arbitrator());

  console.log("\nNext Project ID:");
  console.log(
    (await escrow.getNextProjectId()).toString()
  );

  console.log("\n========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});