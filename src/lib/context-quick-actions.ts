import { findAction, type ContextAction } from "./context-actions";

export function omitContextActions(
  actions: ContextAction[],
  moved: ReadonlySet<string>,
): ContextAction[] {
  return actions.flatMap((action) => {
    if (moved.has(action.id)) return [];
    if (!action.children) return [action];
    const children = omitContextActions(action.children, moved);
    return children.length ? [{ ...action, children }] : [];
  });
}

export function partitionContextActions(
  entity: ContextAction[],
  content: ContextAction[],
  navigation: ContextAction[],
): { quick: ContextAction[]; entity: ContextAction[]; content: ContextAction[] } {
  const find = findAction;
  const copy = [
    entity.find((action) => action.quickCopy),
    find(content, "image:copy"),
    find(content, "link:copy"),
    find(content, "selection:copy"),
  ].find((action) => action && !action.disabled);
  const quick = [find(navigation, "page:back"), copy, find(navigation, "page:go:settings")].filter(
    (action): action is ContextAction => !!action,
  );
  const moved = new Set(quick.map((action) => action.id));
  return {
    quick,
    entity: omitContextActions(entity, moved),
    content: omitContextActions(content, moved),
  };
}

/** Root-only navigation; never insert these commands into content or membership children. */
export function contextNavigationFooter(
  navigation: ContextAction[],
  quick: ContextAction[],
): ContextAction[] {
  return omitContextActions(
    [
      findAction(navigation, "page:my-profile"),
      findAction(navigation, "page:go-to"),
      findAction(navigation, "page:refresh"),
    ].filter((action): action is ContextAction => !!action),
    new Set(quick.map((action) => action.id)),
  );
}
