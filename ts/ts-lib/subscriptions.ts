import { Popup } from "./popup";
import { TranslatedText } from "./textLanguage";



export class Subscriptions {

  private static cscPlanID = 0;
  
  public static subscriptionStatus: boolean = true;
  private static lastChecked: number = 0;
  public static isSubscribed() {
    /* await */ this.updateSubscriptionStatus();
    return Subscriptions.subscriptionStatus;
  }

  public static async updateSubscriptionStatus() {
    return; //TODO - Just return atm since we don't have a cscPlanID
    if (new Date().getTime() - Subscriptions.lastChecked > 1000 * 10) {
      const result = <boolean>await new Promise(resolve => {
        try {
          overwolf.profile.subscriptions.getActivePlans((info) => { 
            resolve(info.success && info.plans != null && info.plans.includes(Subscriptions.cscPlanID));
          });
        } catch {
          resolve(false);
        }
      });
  
      Subscriptions.subscriptionStatus = result;
      Subscriptions.lastChecked = new Date().getTime(); //Just in case, prevent spam
    }
  }

  public static async subscribe() {
    Popup.message(TranslatedText.subscription.english, 'BETA TESTING: Not currently available, try again later'); //TODO
    //overwolf.utils.openStore(<any>{ page:overwolf.utils.enums.eStorePage.SubscriptionPage });
  }


}