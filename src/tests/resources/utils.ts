export const createDefaultHeaders = (
  provider: string,
  authorization: string
) => {
  return {
    'x-axon-provider': provider,
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
};
