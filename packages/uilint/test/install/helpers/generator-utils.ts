/**
 * Test helper to consume an async generator and extract both events and result
 */
export async function consumeGenerator<TYield, TReturn>(
  generator: AsyncGenerator<TYield, TReturn>
): Promise<{ events: TYield[]; result: TReturn }> {
  const events: TYield[] = [];
  let iteratorResult: IteratorResult<TYield, TReturn>;
  
  while (true) {
    iteratorResult = await generator.next();
    
    if (iteratorResult.done) {
      // This is the return value
      return { events, result: iteratorResult.value };
    }
    
    // This is a yielded value
    events.push(iteratorResult.value);
  }
}
