const handlebars = require('handlebars');
const { DateTime } = require('luxon');
const semver = require('semver');
const { mergeChildConfig } = require('../../../config');

function generateBranchConfig(branchUpgrades) {
  logger.debug(`generateBranchConfig(${branchUpgrades.length})`);
  logger.trace({ config: branchUpgrades });
  let config = {
    upgrades: [],
  };
  const hasGroupName = branchUpgrades[0].groupName !== null;
  logger.debug(`hasGroupName: ${hasGroupName}`);
  // Use group settings only if multiple upgrades or lazy grouping is disabled
  const depNames = [];
  const newValue = [];
  const toVersions = [];
  branchUpgrades.forEach(upg => {
    if (!depNames.includes(upg.depName)) {
      depNames.push(upg.depName);
    }
    if (!toVersions.includes(upg.toVersion)) {
      toVersions.push(upg.toVersion);
    }
    if (upg.commitMessageExtra) {
      const extra = handlebars.compile(upg.commitMessageExtra)(upg);
      if (!newValue.includes(extra)) {
        newValue.push(extra);
      }
    }
  });
  const groupEligible =
    depNames.length > 1 ||
    toVersions.length > 1 ||
    (!toVersions[0] && newValue.length > 1) ||
    branchUpgrades[0].lazyGrouping === false;
  if (newValue.length > 1 && !groupEligible) {
    // eslint-disable-next-line no-param-reassign
    branchUpgrades[0].commitMessageExtra = `to v${toVersions[0]}`;
  }
  logger.debug(`groupEligible: ${groupEligible}`);
  const useGroupSettings = hasGroupName && groupEligible;
  logger.debug(`useGroupSettings: ${useGroupSettings}`);
  let releaseTimestamp;
  for (const branchUpgrade of branchUpgrades) {
    let upgrade = { ...branchUpgrade };
    upgrade.prettyDepType =
      upgrade.prettyDepType || upgrade.depType || 'dependency';
    if (useGroupSettings) {
      // Now overwrite original config with group config
      upgrade = mergeChildConfig(upgrade, upgrade.group);
      upgrade.isGroup = true;
    } else {
      delete upgrade.groupName;
    }
    // Delete group config regardless of whether it was applied
    delete upgrade.group;
    delete upgrade.lazyGrouping;
    const isTypesGroup =
      depNames.length === 2 &&
      !hasGroupName &&
      ((branchUpgrades[0].depName.startsWith('@types/') &&
        branchUpgrades[0].depName.endsWith(branchUpgrades[1].depName)) ||
        (branchUpgrades[1].depName.startsWith('@types/') &&
          branchUpgrades[1].depName.endsWith(branchUpgrades[0].depName)));
    // istanbul ignore else
    if (toVersions.length > 1 && !isTypesGroup) {
      logger.debug({ toVersions });
      delete upgrade.commitMessageExtra;
      upgrade.recreateClosed = true;
    } else if (newValue.length > 1 && upgrade.isDigest) {
      logger.debug({ newValue });
      delete upgrade.commitMessageExtra;
      upgrade.recreateClosed = true;
    } else if (semver.valid(toVersions[0])) {
      upgrade.isRange = false;
    }
    // extract parentDir and baseDir from packageFile
    if (upgrade.packageFile) {
      const packagePath = upgrade.packageFile.split('/');
      if (packagePath.length > 0) {
        packagePath.splice(-1, 1);
      }
      if (packagePath.length > 0) {
        upgrade.parentDir = packagePath[packagePath.length - 1];
        upgrade.baseDir = packagePath.join('/');
      } else {
        upgrade.parentDir = '';
        upgrade.baseDir = '';
      }
    }
    // Use templates to generate strings
    logger.debug('Compiling branchName: ' + upgrade.branchName);
    upgrade.branchName = handlebars.compile(upgrade.branchName)(upgrade);
    if (upgrade.semanticCommits && !upgrade.commitMessagePrefix) {
      logger.debug('Upgrade has semantic commits enabled');
      let semanticPrefix = upgrade.semanticCommitType;
      if (upgrade.semanticCommitScope) {
        semanticPrefix += `(${handlebars.compile(upgrade.semanticCommitScope)(
          upgrade
        )})`;
      }
      upgrade.commitMessagePrefix = `${semanticPrefix}: `;
      upgrade.toLowerCase = upgrade.semanticCommitType.match(/[A-Z]/) === null;
    }
    // Compile a few times in case there are nested templates
    upgrade.commitMessage = handlebars.compile(upgrade.commitMessage || '')(
      upgrade
    );
    upgrade.commitMessage = handlebars.compile(upgrade.commitMessage)(upgrade);
    upgrade.commitMessage = handlebars.compile(upgrade.commitMessage)(upgrade);
    upgrade.commitMessage = upgrade.commitMessage.trim(); // Trim exterior whitespace
    upgrade.commitMessage = upgrade.commitMessage.replace(/\s+/g, ' '); // Trim extra whitespace inside string
    upgrade.commitMessage = upgrade.commitMessage.replace(
      /to vv(\d)/,
      'to v$1'
    );
    if (upgrade.toLowerCase) {
      // We only need to lowercvase the first line
      const splitMessage = upgrade.commitMessage.split('\n');
      splitMessage[0] = splitMessage[0].toLowerCase();
      upgrade.commitMessage = splitMessage.join('\n');
    }
    if (upgrade.commitBody) {
      upgrade.commitMessage = `${upgrade.commitMessage}\n\n${handlebars.compile(
        upgrade.commitBody
      )(upgrade)}`;
    }
    logger.debug(`commitMessage: ` + JSON.stringify(upgrade.commitMessage));
    if (upgrade.prTitle) {
      upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
      upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
      upgrade.prTitle = handlebars
        .compile(upgrade.prTitle)(upgrade)
        .trim()
        .replace(/\s+/g, ' ');
      if (upgrade.toLowerCase) {
        upgrade.prTitle = upgrade.prTitle.toLowerCase();
      }
    } else {
      [upgrade.prTitle] = upgrade.commitMessage.split('\n');
    }
    upgrade.prTitle += upgrade.hasBaseBranches ? ' ({{baseBranch}})' : '';
    if (upgrade.isGroup) {
      upgrade.prTitle +=
        upgrade.updateType === 'major' && upgrade.separateMajorMinor
          ? ' (major)'
          : '';
      upgrade.prTitle +=
        upgrade.updateType === 'minor' && upgrade.separateMinorPatch
          ? ' (minor)'
          : '';
      upgrade.prTitle += upgrade.updateType === 'patch' ? ' (patch)' : '';
    }
    // Compile again to allow for nested handlebars templates
    upgrade.prTitle = handlebars.compile(upgrade.prTitle)(upgrade);
    logger.debug(`prTitle: ` + JSON.stringify(upgrade.prTitle));
    config.upgrades.push(upgrade);
    if (upgrade.releaseTimestamp) {
      if (releaseTimestamp) {
        const existingStamp = DateTime.fromISO(releaseTimestamp);
        const upgradeStamp = DateTime.fromISO(upgrade.releaseTimestamp);
        if (upgradeStamp > existingStamp) {
          releaseTimestamp = upgrade.releaseTimestamp; // eslint-disable-line
        }
      } else {
        releaseTimestamp = upgrade.releaseTimestamp; // eslint-disable-line
      }
    }
  }
  if (
    depNames.length === 2 &&
    !hasGroupName &&
    config.upgrades[0].depName.startsWith('@types/') &&
    config.upgrades[0].depName.endsWith(config.upgrades[1].depName)
  ) {
    logger.debug('Found @types - reversing upgrades to use depName in PR');
    config.upgrades.reverse();
    config.upgrades[0].recreateClosed = false;
    config.hasTypes = true;
  } else {
    config.upgrades.sort((a, b) => {
      // istanbul ignore if
      if (a.fileReplacePosition && b.fileReplacePosition) {
        // This is because we need to replace from the bottom of the file up
        return a.fileReplacePosition > b.fileReplacePosition ? -1 : 1;
      }
      if (a.depName < b.depName) return -1;
      if (a.depName > b.depName) return 1;
      return 0;
    });
  }
  // Now assign first upgrade's config as branch config
  config = { ...config, ...config.upgrades[0], releaseTimestamp };
  config.canBeUnpublished = config.upgrades.some(
    upgrade => upgrade.canBeUnpublished
  );
  config.reuseLockFiles = config.upgrades.every(
    upgrade => upgrade.updateType !== 'lockFileMaintenance'
  );
  config.masterIssueApproval = config.upgrades.some(
    upgrade => upgrade.masterIssueApproval
  );
  config.automerge = config.upgrades.every(upgrade => upgrade.automerge);
  config.blockedByPin = config.upgrades.every(upgrade => upgrade.blockedByPin);
  if (config.upgrades.every(upgrade => upgrade.updateType === 'pin')) {
    logger.debug('Overriding schedule for Pin PR');
    config.schedule = [];
  }
  return config;
}

module.exports = {
  generateBranchConfig,
};
