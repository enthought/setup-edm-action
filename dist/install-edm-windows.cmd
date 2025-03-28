@ECHO OFF

:: (C) Copyright 2020-2025 Enthought, Inc., Austin, TX
:: All rights reserved.
::
:: This software is provided without warranty under the terms of the BSD
:: license included in LICENSE.txt and may be redistributed only under
:: the conditions described in the aforementioned license. The license
:: is also available online at http://www.enthought.com/licenses/BSD.txt
::
:: Thanks for using Enthought open source!

:: Options
:: %1 -- EDM VERSION
:: %2 -- Directory path for storing the downloaded installer

SETLOCAL EnableDelayedExpansion

SET INSTALL_EDM_VERSION=%1
SET DOWNLOAD_DIR=%2

FOR /F "tokens=1,2,3 delims=." %%a in ("%INSTALL_EDM_VERSION%") do (
    SET MAJOR=%%a
    SET MINOR=%%b
    SET REVISION=%%c
)

SET EDM_MAJOR_MINOR=%MAJOR%.%MINOR%
SET EDM_PACKAGE=edm_cli_%INSTALL_EDM_VERSION%
SET EDM_INSTALLER_PATH=%DOWNLOAD_DIR%\%EDM_PACKAGE%.msi

rem We special case the installer name because they changed after 4.1.0
IF /I %EDM_MAJOR_MINOR%==4.0 (
   SET EDM_URL=https://package-data.enthought.com/edm/win_x86_64/%EDM_MAJOR_MINOR%/%EDM_PACKAGE%_x86_64.msi
) ELSE ( IF /I %MAJOR% GEQ 4 (
   SET EDM_URL=https://package-data.enthought.com/edm/win_x86_64/%EDM_MAJOR_MINOR%/%EDM_PACKAGE%_win_x86_64.msi
) ELSE (
   SET EDM_URL=https://package-data.enthought.com/edm/win_x86_64/%EDM_MAJOR_MINOR%/%EDM_PACKAGE%_x86_64.msi
))

@ECHO.%EDM_URL%
SET COMMAND="(new-object net.webclient).DownloadFile('%EDM_URL%', '%EDM_INSTALLER_PATH%')"

IF NOT EXIST %EDM_INSTALLER_PATH% CALL powershell.exe -Command %COMMAND% || GOTO error
CALL msiexec /qn /i %EDM_INSTALLER_PATH% EDMAPPDIR=C:\Enthought\edm || GOTO error

ENDLOCAL
@ECHO.DONE
EXIT

:error:
ENDLOCAL
@ECHO.ERROR
EXIT /b %ERRORLEVEL%
