// (C) Copyright 2020 Enthought, Inc., Austin, TX
// All rights reserved.
//
// This software is provided without warranty under the terms of the BSD
// license included in LICENSE.txt and may be redistributed only under
// the conditions described in the aforementioned license. The license
// is also available online at http://www.enthought.com/licenses/BSD.txt
//
// Thanks for using Enthought open source!

const child_process = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

// This action uses only Node.js built-ins, so it runs from src/ without a
// build step. The helpers below implement the few parts of @actions/core
// and @actions/exec it needs, using the runner's documented interface:
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands


function getInput(name) {
    // The runner passes input `name` in the environment variable
    // INPUT_<NAME>: upper-cased, with spaces (but not hyphens) replaced
    // by underscores. Both inputs of this action are required or have a
    // default, so an empty value is an error.
    const key = "INPUT_" + name.replace(/ /g, "_").toUpperCase()
    const value = (process.env[key] || "").trim()
    if (!value) {
        throw new Error("Input required and not supplied: " + name)
    }
    return value
}


function escapeData(message) {
    // Escape a workflow command value, as @actions/core does.
    return String(message)
        .replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}


function info(message) {
    // Write synchronously, so the line precedes the output of any child
    // process started next (console.log to a pipe can be asynchronous).
    fs.writeSync(1, message + os.EOL)
}


function warning(message) {
    info("::warning::" + escapeData(message))
}


function setFailed(message) {
    info("::error::" + escapeData(message))
    process.exitCode = 1
}


function addPath(dir) {
    // Prepend `dir` to PATH for the subsequent steps of the job.
    info("Adding " + dir + " to PATH")
    if (process.env.GITHUB_PATH) {
        fs.appendFileSync(process.env.GITHUB_PATH, dir + os.EOL, "utf8")
    }
    process.env.PATH = dir + path.delimiter + process.env.PATH
}


function expandTilde(filepath) {
    // Expand a leading ~ (home directory) or ~+ (working directory).
    if (filepath === "~" || /^~[\\/]/.test(filepath)) {
        return path.join(os.homedir(), filepath.slice(1))
    }
    if (filepath === "~+" || /^~\+[\\/]/.test(filepath)) {
        return path.join(process.cwd(), filepath.slice(2))
    }
    return filepath
}


function run(file, args, options = {}) {
    // Run a command with inherited stdio; throw unless it exits with 0.
    const label = [file, ...args].join(" ")
    info("[command]" + label)
    const result = child_process.spawnSync(
        file, args, {stdio: "inherit", ...options}
    )
    if (result.error) {
        throw result.error
    }
    if (result.signal) {
        throw new Error(
            "The process '" + label + "' was killed by " + result.signal
        )
    }
    if (result.status !== 0) {
        throw new Error(
            "The process '" + label + "' failed with exit code "
            + result.status
        )
    }
}


function runCmdScript(script, args) {
    // Run a Windows .cmd script. Node refuses to spawn .cmd files without
    // a shell; with `shell: true` it runs `cmd.exe /d /s /c "<line>"`.
    // Every argument is quoted; the script strips the quotes with %~N.
    // A quote inside a value would end the quoting and let cmd.exe run
    // the rest as commands; no valid version, path or checksum has one.
    const bad = args.find((arg) => arg.includes('"'))
    if (bad !== undefined) {
        throw new Error("Invalid character '\"' in argument: " + bad)
    }
    const line = [script, ...args].map((arg) => '"' + arg + '"').join(" ")
    run(line, [], {shell: true})
}


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


function installerPlatform(version) {
    // The cli_installers.csv platform of the installer this runner uses,
    // e.g. 'osx-arm64'. Apple silicon installers exist from EDM 4.1
    // onwards; for an older `version` the x86_64 one runs under Rosetta.
    // Without a `version`, the runner's native platform.
    if (process.platform === "linux") {
        return "linux-x86_64"
    }
    if (process.platform === "win32") {
        return "win-x86_64"
    }
    if (process.platform === "darwin") {
        if (process.arch !== "arm64") {
            return "osx-x86_64"
        }
        if (version === undefined) {
            return "osx-arm64"
        }
        const [major, minor] = version.split(".").map(Number)
        const hasArm64 = major > 4 || (major === 4 && minor >= 1)
        return hasArm64 ? "osx-arm64" : "osx-x86_64"
    }
    throw new Error("Unsupported platform.")
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


function resolveLatestVersion(table, platform) {
    // The newest EDM version with an installer for `platform`, taken from
    // cli_installers.csv (the EDM releases are not publicly queryable).
    // Installers are not published for every platform of every release,
    // e.g. there are no macOS installers after 4.1.3.
    const versions = table
        .filter((r) => r.platform === platform)
        .map((r) => r.version)
        .sort(compareVersions)
    if (versions.length === 0) {
        throw new Error("No EDM installers are known for " + platform)
    }
    return versions[versions.length - 1]
}


function lookupSha256(table, version, platform) {
    // Return the expected SHA256 of the installer for `version` and
    // `platform` as a list of extra script arguments, or an empty list
    // if the version is not listed.
    const row = table.find(
        (r) => r.version === version && r.platform === platform
    )
    if (row) {
        return [row.sha256]
    }
    warning(
        "No SHA256 checksum is known for EDM " + version + " (" + platform
        + "); the installer will not be verified."
    )
    return []
}


function main() {
    // Main function to be run when the action is invoked.
    try {
        // Requested EDM version, e.g. '4.1.8' or 'latest'
        const requestedVersion = getInput("edm-version")
        const downloadDir = expandTilde(
            path.normalize(getInput("download-directory"))
        )

        // Create the download directory.
        info(
            "Using directory for storing downloaded installer: " + downloadDir
        )
        fs.mkdirSync(downloadDir, {recursive: true})

        const table = readInstallerTable()
        let version = requestedVersion
        if (requestedVersion.toLowerCase() === "latest") {
            version = resolveLatestVersion(table, installerPlatform())
            info("Resolved edm-version 'latest' to " + version)
        }
        const platform = installerPlatform(version)
        const sha256 = lookupSha256(table, version, platform)

        if (process.platform === "linux") {
            installEdmLinux(version, downloadDir, sha256)
        } else if (process.platform === "darwin") {
            const arch = platform.slice("osx-".length)
            installEdmOSX(version, downloadDir, arch, sha256)
        } else {
            installEdmWindows(version, downloadDir, sha256)
        }
    }
    catch (error) {
        setFailed(error.message)
    }
}


function installEdmLinux(version, downloadDir, sha256) {
    // Install EDM for Linux and add it to PATH such that edm can
    // be used directly in GitHub Actions workflows.
    run(
        "bash",
        [
            path.join(__dirname, "install-edm-linux.sh"),
            version, downloadDir, ...sha256
        ]
    )
    addPath(path.join(os.homedir(), "edm", "bin"))
}


function installEdmOSX(version, downloadDir, arch, sha256) {
    // Install EDM for OSX
    run(
        "sh",
        [
            path.join(__dirname, "install-edm-osx.sh"),
            version, downloadDir, arch, ...sha256
        ]
    )
    // no need to update path for OSX
}


function installEdmWindows(version, downloadDir, sha256) {
    // Install EDM for Windows and add it to PATH such that edm can
    // be used directly in GitHub Actions workflows.
    runCmdScript(
        path.join(__dirname, "install-edm-windows.cmd"),
        [version, downloadDir, ...sha256]
    )
    addPath(path.join("C:\\", "Enthought", "edm"))
}


main()
