'use strict';

async function openModal(page, modalId) {
    await page.evaluate((id) => {
        // eslint-disable-next-line no-undef
        window.jQuery(`#${id}`).modal('show');
    }, modalId);
    await waitForModalShown(page, modalId);
}

async function waitForModalShown(page, modalId) {
    await page.waitForFunction((id) => {
        const el = document.getElementById(id);
        return el && el.classList.contains('show') && el.style.display !== 'none';
    }, modalId);
}

async function waitForModalHidden(page, modalId) {
    await page.waitForFunction((id) => {
        const el = document.getElementById(id);
        return !el || !el.classList.contains('show');
    }, modalId);
}

async function dragRow(page, fromSelector, toSelector) {
    const from = await page.locator(fromSelector).boundingBox();
    const to = await page.locator(toSelector).boundingBox();
    if (!from || !to) {
        throw new Error(`dragRow: missing bounding box (from=${!!from} to=${!!to})`);
    }
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // Multi-step move so jQuery UI / DataTables RowReorder fires its events.
    for (let step = 1; step <= 10; step += 1) {
        await page.mouse.move(
            start.x + ((end.x - start.x) * step) / 10,
            start.y + ((end.y - start.y) * step) / 10,
            { steps: 5 }
        );
    }
    await page.mouse.up();
}

module.exports = { openModal, waitForModalShown, waitForModalHidden, dragRow };
