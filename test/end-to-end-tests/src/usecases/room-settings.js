/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const assert = require('assert');
const {acceptDialog} = require('./dialog');

async function setSettingsToggle(session, toggle, enabled) {
    const className = await session.getElementProperty(toggle, "className");
    const checked = className.includes("mx_ToggleSwitch_on");
    if (checked !== enabled) {
        await toggle.click();
        session.log.done();
        return true;
    } else {
        session.log.done("already set");
    }
}

module.exports = async function changeRoomSettings(session, settings) {
    session.log.startGroup(`changes the room settings`);
    /// XXX delay is needed here, possibly because the header is being rerendered
    /// click doesn't do anything otherwise
    await session.delay(1000);
    const settingsButton = await session.query(".mx_RoomHeader .mx_AccessibleButton[title=Settings]");
    await settingsButton.click();
    //find tabs
    const tabButtons = await session.queryAll(".mx_RoomSettingsDialog .mx_TabbedView_tabLabel");
    const tabLabels = await Promise.all(tabButtons.map(t => session.innerText(t)));
    const securityTabButton = tabButtons[tabLabels.findIndex(l => l.toLowerCase().includes("security"))];

    const generalSwitches = await session.queryAll(".mx_RoomSettingsDialog .mx_ToggleSwitch");
    const isDirectory = generalSwitches[0];

    if (typeof settings.directory === "boolean") {
        session.log.step(`sets directory listing to ${settings.directory}`);
        await setSettingsToggle(session, isDirectory, settings.directory);
    }

    if (settings.alias) {
        session.log.step(`sets alias to ${settings.alias}`);
        const aliasField = await session.query(".mx_RoomSettingsDialog .mx_AliasSettings input[type=text]");
        await session.replaceInputText(aliasField, settings.alias.substring(1, settings.alias.lastIndexOf(":")));
        const addButton = await session.query(".mx_RoomSettingsDialog .mx_AliasSettings .mx_AccessibleButton");
        await addButton.click();
        await session.delay(10); // delay to give time for the validator to run and check the alias
        session.log.done();
    }

    securityTabButton.click();
    await session.delay(500);
    const securitySwitches = await session.queryAll(".mx_RoomSettingsDialog .mx_ToggleSwitch");
    const e2eEncryptionToggle = securitySwitches[0];

    if (typeof settings.encryption === "boolean") {
        session.log.step(`sets room e2e encryption to ${settings.encryption}`);
        const clicked = await setSettingsToggle(session, e2eEncryptionToggle, settings.encryption);
        // if enabling, accept beta warning dialog
        if (clicked && settings.encryption) {
            await acceptDialog(session, "Enable encryption?");
        }
    }

    if (settings.visibility) {
        session.log.step(`sets visibility to ${settings.visibility}`);
        const radios = await session.queryAll(".mx_RoomSettingsDialog input[type=radio]");
        assert.equal(radios.length, 7);
        const inviteOnly = radios[0];
        const publicNoGuests = radios[1];
        const publicWithGuests = radios[2];

        if (settings.visibility === "invite_only") {
            await inviteOnly.click();
        } else if (settings.visibility === "public_no_guests") {
            await publicNoGuests.click();
        } else if (settings.visibility === "public_with_guests") {
            await publicWithGuests.click();
        } else {
            throw new Error(`unrecognized room visibility setting: ${settings.visibility}`);
        }
        session.log.done();
    }

    const closeButton = await session.query(".mx_RoomSettingsDialog .mx_Dialog_cancelButton");
    await closeButton.click();

    session.log.endGroup();
};
