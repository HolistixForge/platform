# Licensing

Demiurge is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

## What is AGPL-3.0?

The AGPL-3.0 is a strong copyleft license that guarantees end users the freedom to run, study, share, and modify the software. It is specifically designed for software that runs over a network (like web services and SaaS applications).

### Key Features

✅ **Permissions:**
- **Commercial use** - You can use this software for commercial purposes
- **Distribution** - You can distribute this software
- **Modification** - You can modify this software
- **Patent use** - You get an express grant of patent rights from contributors
- **Private use** - You can use and modify the software privately

⚠️ **Conditions:**
- **Disclose source** - When you distribute the software, you must make the source code available
- **License and copyright notice** - You must include the original license and copyright notice
- **Network use is distribution** - If you run a modified version as a service over a network, you must make the source code available to users of that service
- **Same license** - Derivative works must be licensed under AGPL-3.0
- **State changes** - You must document significant changes you make to the software

❌ **Limitations:**
- **Liability** - The software comes with no liability protection for the authors
- **Warranty** - The software comes with no warranty

## Network Use Clause

The key feature that distinguishes AGPL-3.0 from GPL-3.0 is the **network use clause** (Section 13):

> If you modify this software and provide it as a service over a network (like a web service or SaaS), you must make your modified source code available to users of that service.

This means:
- If you host Demiurge as a service and modify it, you must provide the source code to your users
- Simply using the software internally doesn't trigger this requirement
- You must provide source code access via a prominent notice in your user interface

## Use Cases

### ✅ You Can (No Additional Requirements)

1. **Personal Use**
   - Use Demiurge for your personal projects
   - Modify it for your own use
   - No need to share your modifications if you don't distribute

2. **Internal Business Use**
   - Use Demiurge internally in your organization
   - Modify it for internal use only
   - No need to share modifications if not providing as a service to others

3. **Learning and Research**
   - Study the code
   - Use it for educational purposes
   - Experiment and learn

### ✅ You Can (With Source Code Disclosure)

1. **SaaS/Hosted Service**
   - Host Demiurge as a service for your customers
   - You must make your modified source code available to your users
   - Include a prominent way for users to access the source code

2. **Commercial Product**
   - Integrate Demiurge into a commercial product
   - Distribute modified versions
   - You must provide source code to your users/customers
   - The entire work must be licensed under AGPL-3.0

3. **Modified Versions**
   - Create and distribute modified versions
   - You must license them under AGPL-3.0
   - You must provide source code
   - You must state what changes you made

### ❌ You Cannot

1. **Use Proprietary License**
   - You cannot relicense Demiurge or derivative works under a proprietary license
   - All derivatives must be AGPL-3.0

2. **Remove License Notices**
   - You cannot remove copyright notices
   - You cannot remove license information

3. **Provide Service Without Source**
   - You cannot run a modified version as a service without providing source code access

## Contributing

When you contribute to Demiurge:

- Your contributions will be licensed under AGPL-3.0
- You grant everyone the rights specified in the AGPL-3.0 license
- You retain copyright to your contributions
- You must have the right to contribute the code

See [CONTRIBUTING.md](../CONTRIBUTING.md) for more details.

## Third-Party Dependencies

Demiurge includes third-party dependencies with their own licenses. Most dependencies use permissive licenses (MIT, Apache 2.0, BSD) that are compatible with AGPL-3.0.

Some important notes about dependencies:
- AGPL-3.0 is compatible with GPL-3.0
- AGPL-3.0 can incorporate code under permissive licenses (MIT, Apache, BSD)
- AGPL-3.0 cannot incorporate code under incompatible copyleft licenses (GPL-2.0 without the "or later" clause)

See individual package `package.json` files for dependency license information.

## Frequently Asked Questions

### Q: Can I use Demiurge for my commercial business?

**A:** Yes! AGPL-3.0 allows commercial use. However, if you modify it and provide it as a service, you must make your source code available to your users.

### Q: Can I host Demiurge for my clients?

**A:** Yes, but if you modify it, you must provide the source code to your clients through a prominent link in the application's user interface.

### Q: Can I create a proprietary SaaS based on Demiurge?

**A:** No. Any service based on Demiurge must be licensed under AGPL-3.0, and you must provide source code access to your users. You can charge for your service, but you cannot make it proprietary.

### Q: Do I need to share my modifications?

**A:** Only if you distribute the software or run it as a network service. If you just use it internally without providing access to others, you don't need to share your modifications.

### Q: Can I integrate Demiurge with proprietary software?

**A:** It depends. AGPL-3.0's copyleft is "strong," meaning it can extend to works that interact with AGPL-licensed software over a network. Consult with a lawyer if you're unsure about your specific use case.

### Q: What counts as "providing as a service"?

**A:** If users interact with your modified version of Demiurge over a network (web, API, etc.), that counts as providing a service. The network use clause applies.

### Q: What if I want a different license?

**A:** The maintainers hold the copyright and can offer alternative licenses. However, any contributions from others would require agreement from all contributors or would need to be removed. Contact the maintainers if you have special licensing needs.

### Q: Can I sell support or services for Demiurge?

**A:** Yes! You can charge for support, consulting, hosting, or other services. The license doesn't restrict your ability to make money from services, only from making the software proprietary.

## Compliance Checklist

If you're distributing Demiurge or running it as a service with modifications:

- [ ] Include the full AGPL-3.0 license text
- [ ] Include copyright notices
- [ ] Document the changes you made
- [ ] Provide source code access (via download link, git repository, etc.)
- [ ] If providing as a network service, include a prominent link for users to access the source code
- [ ] Ensure all modifications are also licensed under AGPL-3.0

## Resources

- **Full License Text:** [LICENSE](../LICENSE)
- **AGPL-3.0 on Choose A License:** https://choosealicense.com/licenses/agpl-3.0/
- **GNU's AGPL-3.0 Page:** https://www.gnu.org/licenses/agpl-3.0.html
- **FSF's AGPL FAQ:** https://www.gnu.org/licenses/gpl-faq.html

## Contact

If you have questions about licensing or need clarification about your specific use case, please:
- Open an issue on GitHub
- Contact the maintainers

**Note:** This document provides general information about AGPL-3.0 and is not legal advice. For specific legal questions, consult with a qualified attorney.
