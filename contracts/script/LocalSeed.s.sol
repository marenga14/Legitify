// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {SimpleAccountFactory} from "account-abstraction/samples/SimpleAccountFactory.sol";
import {LegitifyRegistry as R} from "../src/LegitifyRegistry.sol";

/// Local development only: seeds a fictional institution on anvil using its public test keys.
/// Needs VALID_HASH and REVOKED_HASH (bytes32) and STAFF_OWNER (address).
contract LocalSeed is Script {
    function run() external {
        uint256 ownerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        uint256 adminKey = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        bytes32 validHash = vm.envBytes32("VALID_HASH");
        bytes32 revokedHash = vm.envBytes32("REVOKED_HASH");

        vm.startBroadcast(ownerKey);
        EntryPoint entryPoint = new EntryPoint();
        SimpleAccountFactory factory = new SimpleAccountFactory(IEntryPoint(address(entryPoint)));
        R registry = new R(vm.addr(ownerKey));
        registry.registerInstitution("Kilimani University", vm.addr(adminKey));
        registry.registerInstitution("Pwani College", vm.addr(ownerKey));
        vm.stopBroadcast();

        address staff = factory.getAddress(vm.envAddress("STAFF_OWNER"), 0);
        vm.startBroadcast(adminKey);
        registry.addOperator(staff);
        registry.issue(keccak256("valid"), validHash, "");
        registry.issue(keccak256("revoked"), revokedHash, "");
        registry.revoke(keccak256("revoked"), R.RevocationReason.IssuedInError);
        vm.stopBroadcast();

        console2.log("REGISTRY", address(registry));
        console2.log("FACTORY", address(factory));
    }
}
