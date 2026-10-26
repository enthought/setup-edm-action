// (C) Copyright 2020 Enthought, Inc., Austin, TX
// All rights reserved.
//
// This software is provided without warranty under the terms of the BSD
// license included in LICENSE.txt and may be redistributed only under
// the conditions described in the aforementioned license. The license
// is also available online at http://www.enthought.com/licenses/BSD.txt
//
// Thanks for using Enthought open source!

const core = require('@actions/core')
const exec = require('@actions/exec')
const fs = require('fs')
const path = require('path')
const expandTilde = require('expand-tilde')

// Requested EDM version, e.g. '3.7.0' or 'latest'
const requestedVersion = core.getInput('edm-version', { required: true });

// The EDM version to install; 'latest' is resolved in main().
let edmVersion = requestedVersion;

// Directory path for storing downloaded installer
const downloadDir = expandTilde(
    path.normalize(core.getInput('download-directory', { required: true }))
);

function readInstallerTable() {
    // Return the rows of cli_installers.csv as {version, platform, sha256}.
    const table = fs.readFileSync(
        path.join(__dirname, "cli_installers.csv"), "utf8"
    )
    return table.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
        const [version, platform, , sha256] = line.split(",")
        return {version, platform, sha256}
    })
}


function lookupSha256(platform) {
    // Return the expected SHA256 of the installer for the given platform
    // and the requested EDM version as a list of extra script arguments,
    // or an empty list if the version is not listed.
    const row = readInstallerTable().find(
        (r) => r.version === edmVersion && r.platform === platform
    )
    if (row) {
        return [row.sha256]
    }
    core.warning(
        "No SHA256 checksum is known for EDM " + edmVersion + " (" + platform
        + "); the installer will not be verified."
    )
    return []
}


function compareVersions(a, b) {
    // Compare dotted numeric versions, e.g. '4.1.10' > '4.1.7'.
    const pa = a.split(".").map(Number)
    const pb = b.split(".").map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0)
        if (diff !== 0) {
            return diff
        }
    }
    return 0
}


function resolveLatestVersion() {
    // The newest EDM version that has an installer for this runner, taken
    // from cli_installers.csv (the EDM releases are not publicly queryable).
    // Installers are not published for every platform of every release,
    // e.g. there are no macOS installers after 4.1.3.
    let platform
    if (process.platform == "linux") {
        platform = "linux-x86_64"
    } else if (process.platform == "darwin") {
        platform = process.arch === "arm64" ? "osx-arm64" : "osx-x86_64"
    } else if (process.platform == "win32") {
        platform = "win-x86_64"
    } else {
        throw new Error("Unsupported platform.")
    }
    const versions = readInstallerTable()
        .filter((r) => r.platform === platform)
        .map((r) => r.version)
        .sort(compareVersions)
    if (versions.length === 0) {
        throw new Error("No EDM installers are known for " + platform)
    }
    return versions[versions.length - 1]
}


function osxArch() {
    // Apple silicon installers exist from EDM 4.1 onwards; older versions
    // only have x86_64 installers (which run under Rosetta).
    const [major, minor] = edmVersion.split(".").map(Number)
    const hasArm64 = major > 4 || (major === 4 && minor >= 1)
    return (process.arch === "arm64" && hasArm64) ? "arm64" : "x86_64"
}


async function main() {
    // Main function to be run when the action is invoked.

    // Create the download directory.
    core.info(
        "Using directory for storing downloaded installer: " + downloadDir
    )
    fs.mkdirSync(downloadDir, {recursive: true})

    try {

        if (requestedVersion.toLowerCase() === "latest") {
            edmVersion = resolveLatestVersion()
            core.info("Resolved edm-version 'latest' to " + edmVersion)
        }

        if (process.platform == "linux") {
            installEdmLinux()
        } else if (process.platform == "darwin") {
            installEdmOSX()
        } else if (process.platform == "win32") {
            installEdmWindows()
        } else {
            core.setFailed("Unsupported platform.");
        }
    }
    catch (error) {
        core.setFailed(error.message);
    }
}


async function installEdmLinux() {
    // Install EDM for Linux and export the PATH such that edm can
    // be used directly in GitHub Actions workflows.
    await exec.exec(
        "bash",
        [
            path.join(__dirname, "install-edm-linux.sh"),
            edmVersion, downloadDir, ...lookupSha256("linux-x86_64")
        ]
    )
    const newPath = [
        path.join(process.env.HOME, "edm", "bin"),
        process.env.PATH
    ].join(":")

    // Export path so that edm is available
    core.info("Setting Path to " + newPath)
    core.exportVariable("PATH", newPath)

}


async function installEdmOSX() {
    // Install EDM for OSX
    const arch = osxArch()
    await exec.exec(
        "sh",
        [
            path.join(__dirname, "install-edm-osx.sh"),
            edmVersion, downloadDir, arch, ...lookupSha256("osx-" + arch)
        ]
    )
    // no need to update path for OSX

}


async function installEdmWindows() {
    // Install EDM for Windows and export the PATH such that edm can
    // be used directly in GitHub Actions workflows.
    await exec.exec(
        path.join(__dirname, "install-edm-windows.cmd"),
        [edmVersion, downloadDir, ...lookupSha256("win-x86_64")]
    )

    const newPath = [
        path.join("C:\\", "Enthought", "edm"),
        process.env.PATH
    ].join(";")

    // Export path so that edm is available
    core.info("Setting Path to " + newPath)
    core.exportVariable("PATH", newPath)

}


main();
