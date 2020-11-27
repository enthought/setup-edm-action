// (C) Copyright 2018-2020 Enthought, Inc., Austin, TX
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

// EDM Version, e.g. '3.1.1'
const edmVersion = core.getInput('edm-version', { required: true });

// Directory path for storing downloaded installer
const downloadDir = expandTilde(
    path.normalize(core.getInput('download-directory', { required: true }))
);

async function main() {
    // Main function to be run when the action is invoked.

    // Create the download directory.
    core.info(
        "Using directory for storing downloaded installer: " + downloadDir
    )
    fs.mkdirSync(downloadDir, {recursive: true})

    try {

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
        [path.join(__dirname, "install-edm-linux.sh"), edmVersion, downloadDir]
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
    await exec.exec(
        "sh",
        [path.join(__dirname, "install-edm-osx.sh"), edmVersion, downloadDir]
    )
    // no need to update path for OSX

}


async function installEdmWindows() {
    // Install EDM for Windowsand export the PATH such that edm can
    // be used directly in GitHub Actions workflows.
    await exec.exec(
        path.join(__dirname, "install-edm-windows.cmd"),
        [edmVersion, downloadDir]
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
