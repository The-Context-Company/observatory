import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  registerConfigureHook,
  setContextVariable,
} from "@langchain/core/context";

const TCC_HANDLER = "TCC_HANDLER";

let hookRegistered = false;

/**
 * Register a TCCCallbackHandler as a global handler for all LangChain/LangGraph calls.
 *
 * ```ts
 * import { TCCCallbackHandler, setGlobalHandler } from "@contextcompany/langgraph";
 *
 * setGlobalHandler(new TCCCallbackHandler());
 * ```
 */
export const setGlobalHandler = (handler: BaseCallbackHandler) => {
  setContextVariable(TCC_HANDLER, handler);
  if (!hookRegistered) {
    registerConfigureHook({ contextVar: TCC_HANDLER });
    hookRegistered = true;
  }
};

export const clearGlobalHandler = () => {
  setContextVariable(TCC_HANDLER, undefined);
};
