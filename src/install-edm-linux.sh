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

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 EDM_VERSION DOWNLOAD_DIR"
    exit 1
fi

INSTALL_EDM_VERSION=$1
DOWNLOAD_DIR=$2

install_edm() {
    local EDM_MAJOR="$(echo "$INSTALL_EDM_VERSION" | sed -E -e 's/([[:digit:]]+)\..*/\1/')"
    local EDM_MAJOR_MINOR="$(echo "$INSTALL_EDM_VERSION" | sed -E -e 's/([[:digit:]]+\.[[:digit:]]+)\..*/\1/')"
    local EDM_PACKAGE="edm_cli_${INSTALL_EDM_VERSION}"
    local EDM_INSTALLER_PATH="${DOWNLOAD_DIR}/${EDM_PACKAGE}.sh"

    # We special case some versions because the cli name actual urls have changed.
    if [ "$EDM_MAJOR_MINOR" == "4.0" ]; then
        local EDM_URL="https://package-data.enthought.com/edm/rh8_x86_64/${EDM_MAJOR_MINOR}/${EDM_PACKAGE}_linux_x86_64.sh"
    elif [ "$EDM_MAJOR" -ge "4" ]; then
	local EDM_URL="https://package-data.enthought.com/edm/rh8_x86_64/${EDM_MAJOR_MINOR}/${EDM_PACKAGE}_rh8_x86_64.sh"
    else
        local EDM_URL="https://package-data.enthought.com/edm/rh6_x86_64/${EDM_MAJOR_MINOR}/${EDM_PACKAGE}_linux_x86_64.sh"
    fi

    echo "$EDM_URL"
    if [ ! -e "$EDM_INSTALLER_PATH" ]; then
        curl --fail --show-error -o "$EDM_INSTALLER_PATH" -L "$EDM_URL"
    fi

    bash "$EDM_INSTALLER_PATH" -b -p "${HOME}/edm"

}

install_edm
