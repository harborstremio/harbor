import assert from "node:assert/strict";
import test from "node:test";
import { downloadConfirmation } from "../src/lib/download/confirmation.ts";
import { executeContextAction } from "../src/lib/context-actions.ts";

const file = { id: "copy-one", path: "C:/fixtures/one.mkv", title: "Fixture", status: "done" };
test("download confirmation binds actor, exact copy and file scope, not progress", async () => {
  const confirm = downloadConfirmation([file], "delete", "Visible episodes (1 of 3)", "actor");
  assert.match(confirm.description, /1/);
  assert.match(confirm.description, /one.mkv/);
  assert.notEqual(
    confirm.key,
    downloadConfirmation(
      [{ ...file, path: "C:/fixtures/two.mkv" }],
      "delete",
      "Visible episodes (1 of 3)",
      "actor",
    ).key,
  );
  assert.notEqual(
    confirm.key,
    downloadConfirmation([file], "delete", "Visible episodes (1 of 3)", "other").key,
  );
  let files = [file];
  let ran = 0;
  const source = {
    actions: () => [
      {
        id: "delete",
        label: "Delete",
        confirmation: downloadConfirmation(files, "delete", "visible", "actor"),
        run: () => {
          ran++;
        },
      },
    ],
  };
  const armed = source.actions()[0].confirmation.key;
  files = [{ ...file, id: "copy-two" }];
  await assert.rejects(
    executeContextAction(source, "delete", { confirmationKey: armed }),
    /changed/,
  );
  assert.equal(ran, 0);
});
test("print receipts cannot claim to delete a PDF Harbor never saved", () => {
  const receipt = downloadConfirmation(
    [{ ...file, kind: "ebook", format: "pdf" }],
    "delete",
    "One receipt",
    "actor",
  );
  assert.match(receipt.description, /did not save/);
  assert.match(receipt.confirmLabel, /Remove/);
  assert.notEqual(receipt.key, downloadConfirmation([file], "cancel", "One receipt", "actor").key);
});
