#!/bin/bash

# (C) Copyright 2020-2025 Enthought, Inc., Austin, TX
# All rights reserved.
#
# This software is provided without warranty under the terms of the BSD
# license included in LICENSE.txt and may be redistributed only under
# the conditions described in the aforementioned license. The license
# is also available online at http://www.enthought.com/licenses/BSD.txt
#
# Thanks for using Enthought open source!

set -e

if [ "$#" -lt 3 ] || [ "$#" -gt 4 ]; then
    echo "Usage: $0 EDM_VERSION DOWNLOAD_DIR PLATFORM [EXPECTED_SHA256]"
    echo "PLATFORM is osx-x86_64 or osx-arm64"
    exit 1
fi

INSTALL_EDM_VERSION=$1
DOWNLOAD_DIR=$2
PLATFORM=$3
EXPECTED_SHA256=$4

case "$PLATFORM" in
    osx-x86_64) EDM_ARCH="x86_64" ;;
    osx-arm64) EDM_ARCH="arm64" ;;
    *) echo "Unsupported platform: $PLATFORM"; exit 1 ;;
esac

install_edm() {
    local EDM_MAJOR="$(echo "$INSTALL_EDM_VERSION" | sed -E -e 's/([[:digit:]]+)\..*/\1/')"
    local EDM_MAJOR_MINOR="$(echo "$INSTALL_EDM_VERSION" | sed -E -e 's/([[:digit:]]+\.[[:digit:]]+)\..*/\1/')"
    local EDM_PACKAGE="edm_cli_${INSTALL_EDM_VERSION}"
    local EDM_INSTALLER_PATH="${DOWNLOAD_DIR}/${EDM_PACKAGE}_${EDM_ARCH}.pkg"


    # We special case some versions because the installer names have changed.
    # Only x86_64 installers exist before 4.1; arm64 starts with 4.1.
    if [ "$EDM_MAJOR_MINOR" == "4.0" ]; then
        local EDM_URL="https://package-data.enthought.com/edm/osx_x86_64/${EDM_MAJOR_MINOR}/${EDM_PACKAGE}.pkg"
    elif [ "$EDM_MAJOR" -ge "4" ]; then
	local EDM_URL="https://package-data.enthought.com/edm/osx_${EDM_ARCH}/${EDM_MAJOR_MINOR}/${EDM_PACKAGE}_osx_${EDM_ARCH}.pkg"
    else
        local EDM_URL="https://package-data.enthought.com/edm/osx_x86_64/${EDM_MAJOR_MINOR}/${EDM_PACKAGE}.pkg"
    fi

    echo "$EDM_URL"
    if [ ! -e "$EDM_INSTALLER_PATH" ]; then
        curl --fail --show-error -o "$EDM_INSTALLER_PATH" -L "$EDM_URL"
    fi

    if [ -n "$EXPECTED_SHA256" ]; then
        local ACTUAL_SHA256="$(shasum -a 256 "$EDM_INSTALLER_PATH" | cut -d' ' -f1)"
        if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
            echo "SHA256 mismatch for $EDM_INSTALLER_PATH: expected $EXPECTED_SHA256, got $ACTUAL_SHA256"
            rm -f "$EDM_INSTALLER_PATH"
            exit 1
        fi
        echo "SHA256 verified: $ACTUAL_SHA256"
    fi

    sudo installer -pkg "$EDM_INSTALLER_PATH" -target /
}

install_edm
