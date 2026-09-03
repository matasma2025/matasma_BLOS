export interface UserOwnedResource {
  userId: string;
}

export function isOwnedBy<T extends UserOwnedResource>(
  resource: T | null | undefined,
  userId: string,
): resource is T {
  return Boolean(resource && resource.userId === userId);
}

export function areAllOwnedBy<T extends UserOwnedResource>(
  resources: Array<T | null | undefined>,
  userId: string,
): resources is T[] {
  return resources.every((resource) => isOwnedBy(resource, userId));
}