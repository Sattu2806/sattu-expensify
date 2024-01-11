import _ from 'lodash';
import React, {useMemo} from 'react';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import {withOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import FeatureList from '@components/FeatureList';
import * as Expensicons from '@components/Icon/Expensicons';
import * as Illustrations from '@components/Icon/Illustrations';
import IllustratedHeaderPageLayout from '@components/IllustratedHeaderPageLayout';
import LottieAnimations from '@components/LottieAnimations';
import MenuItem from '@components/MenuItem';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as CurrencyUtils from '@libs/CurrencyUtils';
import Navigation from '@libs/Navigation/Navigation';
import * as PolicyUtils from '@libs/PolicyUtils';
import * as ReportUtils from '@libs/ReportUtils';
import * as App from '@userActions/App';
import * as Policy from '@userActions/Policy';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {PolicyMembers, Policy as PolicyType, ReimbursementAccount, UserWallet} from '@src/types/onyx';
import type * as OnyxCommon from '@src/types/onyx/OnyxCommon';
import type {PolicyRoute, WithPolicyOnyxProps} from './withPolicy';
import withPolicyAndFullscreenLoading from './withPolicyAndFullscreenLoading';
import type {WithPolicyAndFullscreenLoadingOnyxProps} from './withPolicyAndFullscreenLoading';

type WorkspaceListPageOnyxProps = {
    /** The list of this user's policies */
    policies: OnyxCollection<PolicyType>;

    /** Bank account attached to free plan */
    reimbursementAccount: OnyxEntry<ReimbursementAccount>;

    /** A collection of objects for all policies which key policy member objects by accountIDs */
    allPolicyMembers: OnyxCollection<PolicyMembers>;

    /** The user's wallet account */
    userWallet: OnyxEntry<UserWallet>;
};

type WithPolicyAndFullscreenLoadingProps = React.ComponentType<
    WithPolicyOnyxProps & {
        route: PolicyRoute;
    } & WithPolicyAndFullscreenLoadingOnyxProps
>;

type WorkspaceListPageProps = WorkspaceListPageOnyxProps;

const workspaceFeatures = [
    {
        icon: Illustrations.MoneyReceipts,
        translationKey: 'workspace.emptyWorkspace.features.trackAndCollect',
    },
    {
        icon: Illustrations.CreditCardsNew,
        translationKey: 'workspace.emptyWorkspace.features.companyCards',
    },
    {
        icon: Illustrations.MoneyWings,
        translationKey: 'workspace.emptyWorkspace.features.reimbursements',
    },
];

/**
 * Dismisses the errors on one item
 */
function dismissWorkspaceError(policyID: string, pendingAction: OnyxCommon.PendingAction) {
    if (pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        Policy.clearDeleteWorkspaceError(policyID);
        return;
    }

    if (pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        Policy.removeWorkspace(policyID);
        return;
    }
    throw new Error('Not implemented');
}

function WorkspacesListPage({
    policies = {},
    allPolicyMembers = {},
    reimbursementAccount = {},
    userWallet = {
        currentBalance: 0,
    } as OnyxEntry<UserWallet>,
}: WorkspaceListPageProps) {
    const theme = useTheme();
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {isOffline} = useNetwork();

    /**
     Get the user's wallet balance
     */
    const getWalletBalance = (isPaymentItem: boolean) => (isPaymentItem ? CurrencyUtils.convertToDisplayString(userWallet?.currentBalance) : undefined);

    /**
     * Gets the menu item for each workspace
     */
    const getMenuItem = (item: any, index: number) => {
        const keyTitle = item.translationKey ? translate(item.translationKey) : item.title;
        const isPaymentItem = item.translationKey === 'common.wallet';

        return (
            <OfflineWithFeedback
                key={`${keyTitle}_${index}`}
                pendingAction={item.pendingAction}
                errorRowStyles={styles.ph5}
                onClose={item.dismissError}
                errors={item.errors}
            >
                <MenuItem
                    title={keyTitle}
                    icon={item.icon}
                    iconType={CONST.ICON_TYPE_WORKSPACE}
                    onPress={item.action}
                    iconStyles={item.iconStyles}
                    iconFill={item.iconFill}
                    shouldShowRightIcon
                    badgeText={getWalletBalance(isPaymentItem)}
                    fallbackIcon={item.fallbackIcon}
                    brickRoadIndicator={item.brickRoadIndicator}
                    disabled={item.disabled}
                />
            </OfflineWithFeedback>
        );
    };

    /**
     * Add free policies (workspaces) to the list of menu items and returns the list of menu items
     */
    const workspaces = useMemo(() => {
        const reimbursementAccountBrickRoadIndicator = !_.isEmpty(reimbursementAccount?.errors) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : '';
        return _.chain(policies)
            .filter((policy) => PolicyUtils.shouldShowPolicy(policy, !!isOffline))
            .map((policy) => ({
                title: policy?.name,
                icon: policy?.avatar ? policy.avatar : ReportUtils.getDefaultWorkspaceAvatar(policy?.name),
                iconType: policy?.avatar ? CONST.ICON_TYPE_AVATAR : CONST.ICON_TYPE_ICON,
                action: () => Navigation.navigate(ROUTES.WORKSPACE_INITIAL.getRoute(policy?.id as string))!,
                iconFill: theme.textLight,
                fallbackIcon: Expensicons.FallbackWorkspaceAvatar,
                brickRoadIndicator: reimbursementAccountBrickRoadIndicator ?? PolicyUtils.getPolicyBrickRoadIndicatorStatus(policy, allPolicyMembers),
                pendingAction: policy?.pendingAction,
                errors: policy?.errors,
                dismissError: () => dismissWorkspaceError(policy?.id ?? '', policy?.pendingAction as OnyxCommon.PendingAction)!,
                disabled: policy?.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
            }))
            .sortBy((policy) => policy?.title?.toLowerCase())
            .value();
    }, [reimbursementAccount?.errors, policies, isOffline, theme.textLight, allPolicyMembers]);

    return (
        <IllustratedHeaderPageLayout
            backgroundColor={theme.PAGE_THEMES[SCREENS.SETTINGS.WORKSPACES].backgroundColor}
            illustration={LottieAnimations.WorkspacePlanet}
            onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS)}
            title={translate('common.workspaces')}
            footer={
                <Button
                    accessibilityLabel={translate('workspace.new.newWorkspace')}
                    success
                    text={translate('workspace.new.newWorkspace')}
                    onPress={() => App.createWorkspaceWithPolicyDraftAndNavigateToIt()}
                />
            }
        >
            {_.isEmpty(workspaces) ? (
                <FeatureList
                    menuItems={workspaceFeatures}
                    headline="workspace.emptyWorkspace.title"
                    description="workspace.emptyWorkspace.subtitle"
                />
            ) : (
                workspaces.map((item, index) => getMenuItem(item, index))
            )}
        </IllustratedHeaderPageLayout>
    );
}

WorkspacesListPage.displayName = 'WorkspacesListPage';

export default withPolicyAndFullscreenLoading(
    withOnyx<WorkspaceListPageProps, WorkspaceListPageOnyxProps>({
        policies: {
            key: ONYXKEYS.COLLECTION.POLICY,
        },
        allPolicyMembers: {
            key: ONYXKEYS.COLLECTION.POLICY_MEMBERS,
        },
        reimbursementAccount: {
            key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
        },
        userWallet: {
            key: ONYXKEYS.USER_WALLET,
        },
    })(WorkspacesListPage) as WithPolicyAndFullscreenLoadingProps,
);
